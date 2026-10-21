import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {MonitorHub} from './src/services/monitor-hub.js';
import {SystemMonitorButton} from './src/ui/topbar.js';

export default class SystemMonitorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._button = new SystemMonitorButton(this._settings, () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._button, 0, 'right');

        this._hub = new MonitorHub(this._settings, snapshot => this._button?.update(snapshot));
        this._hub.start();
    }

    disable() {
        this._hub?.destroy();
        this._hub = null;
        this._button?.destroy();
        this._button = null;
        this._settings = null;
    }
}
