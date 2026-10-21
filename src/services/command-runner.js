import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {logWarn} from '../utils/logging.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');

export function commandExists(name) {
    return GLib.find_program_in_path(name) !== null;
}

/**
 * Runs external programs asynchronously without a shell (argv only).
 * Every running process is killed when destroy() is called.
 */
export class CommandRunner {
    constructor() {
        this._cancellable = new Gio.Cancellable();
    }

    /**
     * @param {string[]} argv
     * @param {number} timeoutSeconds
     * @returns {Promise<string|null>} stdout, or null on failure/timeout/cancel
     */
    async run(argv, timeoutSeconds = 5) {
        if (this._cancellable.is_cancelled())
            return null;

        let timeoutId = 0;
        let cancelId = 0;
        try {
            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);

            timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, timeoutSeconds, () => {
                timeoutId = 0;
                proc.force_exit();
                return GLib.SOURCE_REMOVE;
            });
            cancelId = this._cancellable.connect(() => proc.force_exit());

            const [stdout] = await proc.communicate_utf8_async(null, null);
            return proc.get_successful() ? stdout : null;
        } catch (e) {
            if (!this._cancellable.is_cancelled())
                logWarn(`command failed: ${argv[0]}: ${e.message}`);
            return null;
        } finally {
            if (timeoutId)
                GLib.Source.remove(timeoutId);
            if (cancelId)
                this._cancellable.disconnect(cancelId);
        }
    }

    destroy() {
        this._cancellable.cancel();
    }
}
