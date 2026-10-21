import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Async D-Bus method call. Resolves with the fully unpacked reply body
 * (an array for tuple replies), rejects on error.
 */
export function callMethod(connection, cancellable, {name, path, iface, method, params = null, replyType}) {
    return new Promise((resolve, reject) => {
        connection.call(
            name, path, iface, method, params,
            replyType ? GLib.VariantType.new(replyType) : null,
            Gio.DBusCallFlags.NONE, 5000, cancellable,
            (conn, res) => {
                try {
                    resolve(conn.call_finish(res).recursiveUnpack());
                } catch (e) {
                    reject(e);
                }
            });
    });
}

/** Tracks signal subscriptions so they can all be dropped at once. */
export class SignalSubscriptions {
    constructor(connection) {
        this._connection = connection;
        this._ids = [];
    }

    /** callback(path, interfaceName, signalName, unpackedParams) */
    subscribe(sender, iface, member, callback) {
        const id = this._connection.signal_subscribe(
            sender, iface, member, null, null, Gio.DBusSignalFlags.NONE,
            (_c, _sender, path, ifaceName, signal, params) => {
                callback(path, ifaceName, signal, params.recursiveUnpack());
            });
        this._ids.push(id);
    }

    destroy() {
        for (const id of this._ids)
            this._connection.signal_unsubscribe(id);
        this._ids = [];
    }
}
