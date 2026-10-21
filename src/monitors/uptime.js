import {readText} from '../services/system-info.js';

export class UptimeMonitor {
    /** @returns {{seconds: number}|null} Time since boot (includes suspended time, as /proc/uptime does). */
    poll() {
        const seconds = Number(readText('/proc/uptime')?.split(/\s+/)[0]);
        return Number.isFinite(seconds) ? {seconds} : null;
    }
}
