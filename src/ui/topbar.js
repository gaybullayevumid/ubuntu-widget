import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Dropdown} from './dropdown.js';
import {formatMebibytes, formatPercent, formatTemperature, formatUptime} from '../utils/formatting.js';

const INDICATORS = [
    {key: 'cpu', setting: 'show-cpu', icon: 'computer-symbolic'},
    {key: 'memory', setting: 'show-memory', icon: 'media-flash-symbolic'},
    {key: 'temperature', setting: 'show-temperature', icon: 'weather-clear-symbolic'},
    {key: 'gpu', setting: 'show-gpu', icon: 'video-display-symbolic'},
    {key: 'uptime', setting: 'show-uptime', icon: 'preferences-system-time-symbolic'},
];

export const SystemMonitorButton = GObject.registerClass(
class SystemMonitorButton extends PanelMenu.Button {
    _init(settings, openPreferences) {
        super._init(0.5, 'System Monitor');
        this._settings = settings;

        const box = new St.BoxLayout({style_class: 'system-monitor-box', y_align: Clutter.ActorAlign.CENTER});
        this.add_child(box);

        // Shown only when every indicator is disabled, so the menu stays reachable.
        this._fallbackIcon = new St.Icon({icon_name: 'utilities-system-monitor-symbolic', style_class: 'system-status-icon'});
        box.add_child(this._fallbackIcon);

        this._indicators = {};
        for (const {key, icon} of INDICATORS) {
            const item = new St.BoxLayout({style_class: 'system-monitor-indicator', y_align: Clutter.ActorAlign.CENTER});
            const captionLabel = new St.Icon({icon_name: icon, style_class: 'system-status-icon system-monitor-caption'});
            const value = new St.Label({text: '…', style_class: 'system-monitor-value', y_align: Clutter.ActorAlign.CENTER});
            item.add_child(captionLabel);
            item.add_child(value);
            box.add_child(item);
            this._indicators[key] = {item, value};
        }

        this._dropdown = new Dropdown(this.menu, settings, openPreferences);
        this._lastSnapshot = null;
        this._settingsId = settings.connect('changed', () => this.update(this._lastSnapshot));
        this.update(null);
    }

    update(snapshot) {
        this._lastSnapshot = snapshot;
        const s = this._settings;
        const unit = s.get_string('temperature-unit');
        const snap = snapshot ?? {};

        let anyVisible = false;
        for (const {key, setting} of INDICATORS) {
            const visible = s.get_boolean(setting);
            this._indicators[key].item.visible = visible;
            anyVisible ||= visible;
        }
        this._fallbackIcon.visible = !anyVisible;

        const NA = snapshot ? 'N/A' : '…';
        const text = {
            cpu: snap.cpu ? formatPercent(snap.cpu.percent) : NA,
            memory: snap.memory ? formatMebibytes(snap.memory.usedBytes) : NA,
            temperature: snap.temperature ? formatTemperature(snap.temperature.celsius, unit) : NA,
            gpu: this._gpuText(snap.gpu, unit),
            uptime: snap.uptime ? formatUptime(snap.uptime.seconds) : NA,
        };
        for (const {key} of INDICATORS)
            this._indicators[key].value.text = text[key];

        this._dropdown.update(snap);
    }

    // Utilization if the GPU reports it, otherwise temperature, otherwise a status word.
    _gpuText(gpus, unit) {
        if (!gpus)
            return '…';
        const withUtil = gpus.find(x => x.utilization !== null);
        if (withUtil)
            return formatPercent(withUtil.utilization);
        const withTemp = gpus.find(x => x.temperature !== null);
        if (withTemp)
            return formatTemperature(withTemp.temperature, unit);
        return gpus.some(x => x.suspended) ? 'idle' : 'N/A';
    }

    destroy() {
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = 0;
        }
        this._dropdown.destroy();
        this._dropdown = null;
        super.destroy();
    }
});
