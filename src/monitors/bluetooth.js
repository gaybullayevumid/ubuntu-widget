import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {SignalSubscriptions, callMethod} from '../services/dbus.js';
import {logWarn} from '../utils/logging.js';

const BLUEZ = 'org.bluez';
const UPOWER = 'org.freedesktop.UPower';
const DEBOUNCE_MS = 750;

/**
 * Connected Bluetooth devices with battery levels.
 * Battery source order: BlueZ Battery1 interface, then a matching UPower device.
 */
export class BluetoothMonitor {
    constructor() {
        this._cancellable = new Gio.Cancellable();
        this._subscriptions = null;
        this._debounceId = 0;
    }

    /** Subscribe to D-Bus changes; onChanged() fires (debounced) when a re-poll is worthwhile. */
    start(onChanged) {
        const bus = Gio.DBus.system;
        const subs = new SignalSubscriptions(bus);
        this._subscriptions = subs;

        const trigger = () => {
            if (this._debounceId)
                GLib.Source.remove(this._debounceId);
            this._debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
                this._debounceId = 0;
                onChanged();
                return GLib.SOURCE_REMOVE;
            });
        };

        subs.subscribe(BLUEZ, 'org.freedesktop.DBus.Properties', 'PropertiesChanged',
            (_path, _i, _s, [iface, changed]) => {
                if ((iface === 'org.bluez.Device1' && 'Connected' in changed) ||
                    (iface === 'org.bluez.Adapter1' && 'Powered' in changed) ||
                    iface === 'org.bluez.Battery1')
                    trigger();
            });
        subs.subscribe(BLUEZ, 'org.freedesktop.DBus.ObjectManager', 'InterfacesAdded', trigger);
        subs.subscribe(BLUEZ, 'org.freedesktop.DBus.ObjectManager', 'InterfacesRemoved', trigger);
        subs.subscribe(UPOWER, 'org.freedesktop.UPower', 'DeviceAdded', trigger);
        subs.subscribe(UPOWER, 'org.freedesktop.UPower', 'DeviceRemoved', trigger);
        subs.subscribe(UPOWER, 'org.freedesktop.DBus.Properties', 'PropertiesChanged',
            path => {
                // Only peripherals (e.g. ".../mouse_dev_AA_BB_..."), not the laptop battery.
                if (path.includes('_dev_'))
                    trigger();
            });
    }

    /**
     * @returns {Promise<{available: boolean, powered: boolean, reason: string|null,
     *   devices: Array<{name: string, address: string, icon: string, percentage: number|null, source: string|null}>}>}
     */
    async poll() {
        const bus = Gio.DBus.system;
        let objects;
        try {
            [objects] = await callMethod(bus, this._cancellable, {
                name: BLUEZ, path: '/', iface: 'org.freedesktop.DBus.ObjectManager',
                method: 'GetManagedObjects', replyType: '(a{oa{sa{sv}}})',
            });
        } catch (e) {
            if (!this._cancellable.is_cancelled())
                logWarn(`BlueZ unavailable: ${e.message}`);
            return {available: false, powered: false, reason: 'BlueZ is not running', devices: []};
        }

        const adapter = Object.values(objects).map(i => i['org.bluez.Adapter1']).find(Boolean);
        if (!adapter)
            return {available: false, powered: false, reason: 'No Bluetooth adapter found', devices: []};
        if (!adapter.Powered)
            return {available: true, powered: false, reason: 'Bluetooth is turned off', devices: []};

        const devices = [];
        for (const interfaces of Object.values(objects)) {
            const dev = interfaces['org.bluez.Device1'];
            if (!dev?.Connected)
                continue;
            const percentage = interfaces['org.bluez.Battery1']?.Percentage;
            devices.push({
                name: dev.Alias ?? dev.Name ?? dev.Address,
                address: dev.Address,
                icon: dev.Icon ?? '',
                percentage: Number.isFinite(percentage) ? percentage : null,
                source: Number.isFinite(percentage) ? 'BlueZ' : null,
            });
        }

        if (devices.some(d => d.percentage === null))
            await this._fillFromUPower(bus, devices);

        return {available: true, powered: true, reason: null, devices};
    }

    async _fillFromUPower(bus, devices) {
        try {
            const [paths] = await callMethod(bus, this._cancellable, {
                name: UPOWER, path: '/org/freedesktop/UPower', iface: UPOWER,
                method: 'EnumerateDevices', replyType: '(ao)',
            });
            for (const path of paths) {
                // Every UPower device is inspected; only one whose serial/path matches a connected MAC is used.
                const [props] = await callMethod(bus, this._cancellable, {
                    name: UPOWER, path, iface: 'org.freedesktop.DBus.Properties', method: 'GetAll',
                    params: new GLib.Variant('(s)', ['org.freedesktop.UPower.Device']),
                    replyType: '(a{sv})',
                });
                const serial = String(props.Serial ?? '').toUpperCase();
                for (const dev of devices) {
                    if (dev.percentage !== null)
                        continue;
                    const mac = dev.address.toUpperCase();
                    const matches = serial === mac || path.toUpperCase().includes(mac.replaceAll(':', '_'));
                    const usable = props.IsPresent !== false && Number.isFinite(props.Percentage) &&
                        (props.Percentage > 0 || props.State > 0);
                    if (matches && usable) {
                        dev.percentage = props.Percentage;
                        dev.source = 'UPower';
                    }
                }
            }
        } catch (e) {
            if (!this._cancellable.is_cancelled())
                logWarn(`UPower query failed: ${e.message}`);
        }
    }

    destroy() {
        this._cancellable.cancel();
        if (this._debounceId) {
            GLib.Source.remove(this._debounceId);
            this._debounceId = 0;
        }
        this._subscriptions?.destroy();
        this._subscriptions = null;
    }
}
