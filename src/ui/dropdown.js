import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {DeviceRow} from './device-row.js';
import {formatBytes, formatMebibytes, formatMegahertz, formatPercent, formatTemperature, formatUptime} from '../utils/formatting.js';

const NA = 'N/A';

function makeRow(label) {
    const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
    item.labelActor = new St.Label({text: label, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
    item.valueActor = new St.Label({style_class: 'system-monitor-value', y_align: Clutter.ActorAlign.CENTER});
    item.add_child(item.labelActor);
    item.add_child(item.valueActor);
    return item;
}

/** A titled group of label/value rows; rows are reused unless their count changes. */
class Section {
    constructor(menu, title) {
        this._separator = new PopupMenu.PopupSeparatorMenuItem(title);
        this._body = new PopupMenu.PopupMenuSection();
        this._rows = [];
        menu.addMenuItem(this._separator);
        menu.addMenuItem(this._body);
    }

    setVisible(visible) {
        this._separator.visible = visible;
        this._body.actor.visible = visible;
    }

    /** @param {Array<[string, string]>} entries */
    setRows(entries) {
        if (entries.length !== this._rows.length) {
            this._body.removeAll();
            this._rows = entries.map(([label]) => makeRow(label));
            this._rows.forEach(row => this._body.addMenuItem(row));
        }
        entries.forEach(([label, value], i) => {
            this._rows[i].labelActor.text = label;
            this._rows[i].valueActor.text = value;
        });
    }

    destroy() {
        this._body.destroy();
        this._separator.destroy();
    }
}

export class Dropdown {
    constructor(menu, settings, openPreferences) {
        this._settings = settings;
        this._deviceRows = [];
        this._lastBluetooth = null;
        this._lastBtEnabled = null;

        this._cpu = new Section(menu, 'CPU');
        this._memory = new Section(menu, 'Memory');
        this._temperature = new Section(menu, 'Temperature');
        this._gpu = new Section(menu, 'GPU');
        this._uptime = new Section(menu, 'Uptime');
        this._btSeparator = new PopupMenu.PopupSeparatorMenuItem('Bluetooth devices');
        this._btMessage = makeRow('');
        this._btDevices = new PopupMenu.PopupMenuSection();
        menu.addMenuItem(this._btSeparator);
        menu.addMenuItem(this._btMessage);
        menu.addMenuItem(this._btDevices);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction('Settings', openPreferences);
    }

    update(snapshot) {
        const s = this._settings;
        const unit = s.get_string('temperature-unit');

        this._cpu.setVisible(s.get_boolean('show-cpu'));
        this._memory.setVisible(s.get_boolean('show-memory'));
        this._temperature.setVisible(s.get_boolean('show-temperature'));
        this._gpu.setVisible(s.get_boolean('show-gpu'));
        this._uptime.setVisible(s.get_boolean('show-uptime'));
        const showBt = s.get_boolean('show-bluetooth');
        this._btSeparator.visible = showBt;

        const {cpu, memory, temperature, gpu, uptime, bluetooth} = snapshot;

        this._cpu.setRows([['Usage', cpu ? formatPercent(cpu.percent) : NA]]);

        this._memory.setRows(memory
            ? [['Used', formatMebibytes(memory.usedBytes)],
                ['Total', formatMebibytes(memory.totalBytes)]]
            : [['Used', NA], ['Total', NA]]);

        this._temperature.setRows(temperature
            ? [['CPU', formatTemperature(temperature.celsius, unit)], ['Sensor', temperature.source]]
            : [['CPU', NA], ['Sensor', 'No supported sensor found']]);

        this._gpu.setRows(this._gpuRows(gpu, unit));

        this._uptime.setRows([['Since boot', uptime ? formatUptime(uptime.seconds) : NA]]);

        this._updateBluetooth(showBt ? bluetooth : null, showBt);
    }

    _gpuRows(gpus, unit) {
        if (!gpus)
            return [['Status', 'Waiting for data…']];
        if (gpus.length === 0)
            return [['Status', 'No GPU detected']];
        const rows = [];
        for (const g of gpus) {
            rows.push([g.vendor, g.name]);
            if (g.utilization !== null)
                rows.push(['  Utilization', formatPercent(g.utilization)]);
            if (g.temperature !== null)
                rows.push(['  Temperature', formatTemperature(g.temperature, unit)]);
            if (g.vramUsed !== null && g.vramTotal)
                rows.push(['  VRAM', `${formatBytes(g.vramUsed)} / ${formatBytes(g.vramTotal)}`]);
            if (g.frequencyMHz !== null)
                rows.push(['  Frequency', formatMegahertz(g.frequencyMHz)]);
            if (g.note)
                rows.push(['  Note', g.note]);
        }
        return rows;
    }

    _updateBluetooth(bluetooth, enabled) {
        const signature = JSON.stringify(bluetooth);
        if (signature === this._lastBluetooth && enabled === this._lastBtEnabled)
            return;
        this._lastBluetooth = signature;
        this._lastBtEnabled = enabled;

        const devices = bluetooth?.devices ?? [];
        let message = null;
        if (!enabled)
            message = null;
        else if (!bluetooth)
            message = 'Waiting for data…';
        else if (bluetooth.reason)
            message = bluetooth.reason;
        else if (devices.length === 0)
            message = 'No connected devices';

        this._btMessage.visible = message !== null;
        this._btMessage.labelActor.text = message ?? '';

        if (devices.length !== this._deviceRows.length) {
            this._btDevices.removeAll();
            this._deviceRows = devices.map(() => new DeviceRow());
            this._deviceRows.forEach(row => this._btDevices.addMenuItem(row));
        }
        devices.forEach((d, i) => this._deviceRows[i].update(d));
    }

    destroy() {
        this._deviceRows = [];
        this._btDevices.destroy();
        for (const section of [this._cpu, this._memory, this._temperature, this._gpu, this._uptime])
            section.destroy();
        this._btSeparator.destroy();
        this._btMessage.destroy();
    }
}
