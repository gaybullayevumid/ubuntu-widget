import {readText} from '../services/system-info.js';

export class MemoryMonitor {
    /** @returns {{usedBytes: number, totalBytes: number, percent: number}|null} */
    poll() {
        const text = readText('/proc/meminfo');
        if (!text)
            return null;
        const kib = key => {
            const m = text.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
            return m ? Number(m[1]) : null;
        };
        const total = kib('MemTotal');
        const available = kib('MemAvailable');
        if (!total || available === null)
            return null;
        const used = total - available;
        return {
            usedBytes: used * 1024,
            totalBytes: total * 1024,
            percent: used / total * 100,
        };
    }
}
