import {readText} from '../services/system-info.js';

function readTimes() {
    const line = readText('/proc/stat')?.split('\n').find(l => l.startsWith('cpu '));
    if (!line)
        return null;
    // user nice system idle iowait irq softirq steal (guest time is already in user)
    const f = line.trim().split(/\s+/).slice(1, 9).map(Number);
    if (f.length < 4 || f.some(Number.isNaN))
        return null;
    const idle = f[3] + (f[4] ?? 0);
    return {idle, total: f.reduce((a, b) => a + b, 0)};
}

export class CpuMonitor {
    constructor() {
        this._last = readTimes();
    }

    /** @returns {{percent: number}|null} null until two samples exist or if /proc/stat is unreadable */
    poll() {
        const now = readTimes();
        const last = this._last;
        this._last = now;
        if (!now || !last)
            return null;
        const dTotal = now.total - last.total;
        if (dTotal <= 0)
            return null;
        const busy = (dTotal - (now.idle - last.idle)) / dTotal * 100;
        return {percent: Math.min(100, Math.max(0, busy))};
    }
}
