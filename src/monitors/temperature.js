import {CommandRunner, commandExists} from '../services/command-runner.js';
import {listDir, readNumber, readText} from '../services/system-info.js';

const HWMON = '/sys/class/hwmon';
const THERMAL = '/sys/class/thermal';

// hwmon chip names that report CPU temperature, best first.
const CPU_CHIPS = ['coretemp', 'k10temp', 'zenpower', 'cpu_thermal', 'cpu-thermal'];
// Per-chip temperature labels that mean "whole package", best first.
const PACKAGE_LABELS = ['Package id 0', 'Tctl', 'Tdie', 'CPU'];

function discoverHwmon() {
    const chips = listDir(HWMON).map(dir => ({dir, name: readText(`${HWMON}/${dir}/name`)}));
    for (const wanted of CPU_CHIPS) {
        const chip = chips.find(c => c.name === wanted);
        if (!chip)
            continue;
        const base = `${HWMON}/${chip.dir}`;
        const inputs = listDir(base).filter(f => /^temp\d+_input$/.test(f));
        let pick = null;
        for (const label of PACKAGE_LABELS) {
            pick = inputs.find(f => readText(`${base}/${f.replace('_input', '_label')}`) === label);
            if (pick)
                break;
        }
        pick ??= inputs[0];
        if (pick)
            return {path: `${base}/${pick}`, scale: 1000, source: `${chip.name} (hwmon)`};
    }
    return null;
}

function discoverThermalZone() {
    const zones = listDir(THERMAL).filter(z => z.startsWith('thermal_zone'))
        .map(z => ({z, type: readText(`${THERMAL}/${z}/type`)}));
    for (const wanted of ['x86_pkg_temp', 'acpitz']) {
        const zone = zones.find(z => z.type === wanted);
        if (zone)
            return {path: `${THERMAL}/${zone.z}/temp`, scale: 1000, source: `${wanted} (thermal zone)`};
    }
    return null;
}

export class TemperatureMonitor {
    constructor() {
        this._runner = new CommandRunner();
        this._source = null;
        this._discovered = false;
    }

    /** @returns {Promise<{celsius: number, source: string}|null>} */
    async poll() {
        if (this._source?.path) {
            const raw = readNumber(this._source.path);
            if (raw !== null)
                return {celsius: raw / this._source.scale, source: this._source.source};
            this._source = null;       // sensor vanished; rediscover
            this._discovered = false;
        }

        if (!this._discovered) {
            this._discovered = true;
            this._source = discoverHwmon() ?? discoverThermalZone();
            if (this._source)
                return this.poll();
            // Last resort: lm-sensors, if installed.
            this._source = commandExists('sensors') ? {sensors: true, source: 'lm-sensors'} : null;
        }

        return this._source?.sensors ? this._pollSensors() : null;
    }

    async _pollSensors() {
        const out = await this._runner.run(['sensors', '-j']);
        if (!out)
            return null;
        try {
            const data = JSON.parse(out);
            for (const [chip, features] of Object.entries(data)) {
                if (!/coretemp|k10temp|zenpower|cpu/i.test(chip))
                    continue;
                for (const feature of Object.values(features)) {
                    const key = Object.keys(feature).find(k => /^temp\d+_input$/.test(k));
                    if (key && Number.isFinite(feature[key]))
                        return {celsius: feature[key], source: 'lm-sensors'};
                }
            }
        } catch (_e) {
            // unparsable output: treat as unavailable
        }
        return null;
    }

    destroy() {
        this._runner.destroy();
    }
}
