// Owns the monitors and their polling timers.
import GLib from 'gi://GLib';

import {CpuMonitor} from '../monitors/cpu.js';
import {MemoryMonitor} from '../monitors/memory.js';
import {TemperatureMonitor} from '../monitors/temperature.js';
import {GpuMonitor} from '../monitors/gpu.js';
import {UptimeMonitor} from '../monitors/uptime.js';
import {BluetoothMonitor} from '../monitors/bluetooth.js';
import {logError} from '../utils/logging.js';

/**
 * Calls onUpdate(snapshot) after each poll group completes. Disabled indicators
 * are not polled at all.
 */
export class MonitorHub {
    constructor(settings, onUpdate) {
        this._settings = settings;
        this._onUpdate = onUpdate;
        this._destroyed = false;
        this._timers = [];
        this._busy = {fast: false, gpu: false, bluetooth: false};

        this._cpu = new CpuMonitor();
        this._memory = new MemoryMonitor();
        this._temperature = new TemperatureMonitor();
        this._gpu = new GpuMonitor();
        this._uptime = new UptimeMonitor();
        this._bluetooth = new BluetoothMonitor();

        this.snapshot = {
            cpu: null, memory: null, temperature: null,
            gpu: null, uptime: null, bluetooth: null,
        };

        this._settingsId = this._settings.connect('changed', (_s, key) => this._onSettingsChanged(key));
    }

    start() {
        this._bluetooth.start(() => this._pollBluetooth());
        this._restartTimers();
        this._pollFast();
        this._pollGpu();
        this._pollBluetooth();
    }

    destroy() {
        this._destroyed = true;
        this._clearTimers();
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = 0;
        }
        this._temperature.destroy();
        this._gpu.destroy();
        this._bluetooth.destroy();
        this._onUpdate = null;
    }

    _onSettingsChanged(key) {
        if (key.endsWith('interval'))
            this._restartTimers();
        // Newly enabled indicators should show data immediately.
        this._pollFast();
        this._pollGpu();
        this._pollBluetooth();
        this._emit();
    }

    _restartTimers() {
        this._clearTimers();
        const add = (key, fn) => {
            const seconds = this._settings.get_uint(key);
            this._timers.push(GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
                fn();
                return GLib.SOURCE_CONTINUE;
            }));
        };
        add('refresh-interval', () => this._pollFast());
        add('gpu-refresh-interval', () => this._pollGpu());
        add('bluetooth-refresh-interval', () => this._pollBluetooth());
    }

    _clearTimers() {
        for (const id of this._timers)
            GLib.Source.remove(id);
        this._timers = [];
    }

    _emit() {
        if (!this._destroyed)
            this._onUpdate?.(this.snapshot);
    }

    _pollFast() {
        const s = this._settings;
        const snap = this.snapshot;
        snap.cpu = s.get_boolean('show-cpu') ? this._cpu.poll() : null;
        snap.memory = s.get_boolean('show-memory') ? this._memory.poll() : null;
        snap.uptime = s.get_boolean('show-uptime') ? this._uptime.poll() : null;

        if (!s.get_boolean('show-temperature')) {
            snap.temperature = null;
            this._emit();
            return;
        }
        if (this._busy.fast)
            return;
        this._busy.fast = true;
        this._temperature.poll()
            .then(t => { snap.temperature = t; })
            .catch(e => logError('temperature poll failed', e))
            .finally(() => {
                this._busy.fast = false;
                this._emit();
            });
    }

    _pollGpu() {
        if (!this._settings.get_boolean('show-gpu')) {
            this.snapshot.gpu = null;
            return;
        }
        if (this._busy.gpu)
            return;
        this._busy.gpu = true;
        this._gpu.poll()
            .then(g => { this.snapshot.gpu = g; })
            .catch(e => logError('GPU poll failed', e))
            .finally(() => {
                this._busy.gpu = false;
                this._emit();
            });
    }

    _pollBluetooth() {
        if (!this._settings.get_boolean('show-bluetooth')) {
            this.snapshot.bluetooth = null;
            return;
        }
        if (this._busy.bluetooth)
            return;
        this._busy.bluetooth = true;
        this._bluetooth.poll()
            .then(b => { this.snapshot.bluetooth = b; })
            .catch(e => logError('Bluetooth poll failed', e))
            .finally(() => {
                this._busy.bluetooth = false;
                this._emit();
            });
    }
}
