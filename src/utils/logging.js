const PREFIX = '[system-monitor]';

export function logInfo(...args) {
    console.log(PREFIX, ...args);
}

export function logWarn(...args) {
    console.warn(PREFIX, ...args);
}

export function logError(message, error) {
    console.error(`${PREFIX} ${message}`, error ?? '');
}
