const MIB = 1024 * 1024;
const GIB = MIB * 1024;

export function formatPercent(value) {
    return `${Math.round(value)}%`;
}

export function formatMebibytes(bytes) {
    return `${Math.round(bytes / MIB)} MB`;
}

export function formatBytes(bytes) {
    if (bytes >= GIB)
        return `${(bytes / GIB).toFixed(1)} GiB`;
    return `${Math.round(bytes / MIB)} MiB`;
}

export function formatTemperature(celsius, unit) {
    if (unit === 'fahrenheit')
        return `${Math.round(celsius * 9 / 5 + 32)}°F`;
    return `${Math.round(celsius)}°C`;
}

// Total hours (not split into days) so the label stays short, e.g. "27h 05m".
export function formatUptime(seconds) {
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}h ${minutes}m`;
}

export function formatMegahertz(mhz) {
    return mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${Math.round(mhz)} MHz`;
}
