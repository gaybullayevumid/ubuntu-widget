import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {formatPercent} from '../utils/formatting.js';

const DEVICE_ICONS = {
    'audio-headset': 'audio-headset-symbolic',
    'audio-headphones': 'audio-headphones-symbolic',
    'audio-card': 'audio-speakers-symbolic',
    'input-mouse': 'input-mouse-symbolic',
    'input-keyboard': 'input-keyboard-symbolic',
    'input-gaming': 'input-gaming-symbolic',
    'input-tablet': 'input-tablet-symbolic',
    'phone': 'phone-symbolic',
};

function batteryIconName(percentage) {
    return `battery-level-${Math.round(percentage / 10) * 10}-symbolic`;
}

export const DeviceRow = GObject.registerClass(
class DeviceRow extends PopupMenu.PopupBaseMenuItem {
    _init() {
        super._init({reactive: false, can_focus: false});

        this._deviceIcon = new St.Icon({style_class: 'popup-menu-icon'});
        this.add_child(this._deviceIcon);

        this._name = new St.Label({text: '', x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._name);

        this._batteryIcon = new St.Icon({style_class: 'popup-menu-icon system-monitor-battery-icon'});
        this.add_child(this._batteryIcon);

        this._percent = new St.Label({style_class: 'system-monitor-value', y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._percent);
    }

    /** @param {{name: string, icon: string, percentage: number|null, source: string|null}} device */
    update(device) {
        this._deviceIcon.icon_name = DEVICE_ICONS[device.icon] ?? 'bluetooth-active-symbolic';
        this._name.text = device.name;
        if (device.percentage === null) {
            this._batteryIcon.visible = false;
            this._percent.text = 'Battery N/A';
        } else {
            this._batteryIcon.visible = true;
            this._batteryIcon.icon_name = batteryIconName(device.percentage);
            this._percent.text = formatPercent(device.percentage);
        }
    }
});
