// Low-level readers for procfs/sysfs, shared by the monitors. Shell-independent,
// so the monitors can be exercised with plain `gjs -m` (see tests/README.md).
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const decoder = new TextDecoder();

/** Reads a small procfs/sysfs file. Returns null if unreadable. */
export function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? decoder.decode(bytes).trim() : null;
    } catch (_e) {
        return null;
    }
}

/** Reads a file holding a single number. Returns null if missing or non-numeric. */
export function readNumber(path) {
    const text = readText(path);
    if (text === null)
        return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
}

/** Lists directory entry names (empty array if the directory is missing). */
export function listDir(path) {
    const names = [];
    try {
        const enumerator = Gio.File.new_for_path(path).enumerate_children(
            'standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null)
            names.push(info.get_name());
        enumerator.close(null);
    } catch (_e) {
        // directory missing or unreadable
    }
    return names.sort();
}
