// Standalone smoke test: runs the real monitors against this machine and checks
// that results are well-formed. Needs no GNOME Shell. Run: gjs -m tests/smoke.js
import GLib from 'gi://GLib';

import {CpuMonitor} from '../src/monitors/cpu.js';
import {MemoryMonitor} from '../src/monitors/memory.js';
import {UptimeMonitor} from '../src/monitors/uptime.js';
import {TemperatureMonitor} from '../src/monitors/temperature.js';
import {GpuMonitor} from '../src/monitors/gpu.js';
import {BluetoothMonitor} from '../src/monitors/bluetooth.js';
import * as fmt from '../src/utils/formatting.js';

let failures = 0;
function check(name, cond, detail = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ->  ${detail}` : ''}`);
    if (!cond)
        failures++;
}
const inRange = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

// Pure formatting
check('formatUptime', fmt.formatUptime(27 * 3600 + 5 * 60 + 9) === '27h 05m');
check('formatTemperature F', fmt.formatTemperature(100, 'fahrenheit') === '212°F');
check('formatBytes', fmt.formatBytes(2 * 1024 ** 3) === '2.0 GiB');

// CPU needs two samples; generate some load in between.
const cpu = new CpuMonitor();
const loop = GLib.MainLoop.new(null, false);
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { loop.quit(); return GLib.SOURCE_REMOVE; });
let x = 0;
for (let i = 0; i < 2e7; i++) x += i % 7;
loop.run();
const c = cpu.poll();
check('cpu', c !== null && inRange(c.percent, 0, 100), c ? `${c.percent.toFixed(1)}%` : 'null');

const m = new MemoryMonitor().poll();
check('memory', m !== null && m.usedBytes > 0 && m.usedBytes <= m.totalBytes,
    m ? `${fmt.formatBytes(m.usedBytes)} / ${fmt.formatBytes(m.totalBytes)}` : 'null');

const u = new UptimeMonitor().poll();
check('uptime', u !== null && u.seconds > 0, u ? fmt.formatUptime(u.seconds) : 'null');

const tm = new TemperatureMonitor();
const t = await tm.poll();
// A machine without sensors is a legitimate null; when present it must be plausible.
check('temperature', t === null || inRange(t.celsius, -20, 130), t ? `${t.celsius}°C via ${t.source}` : 'no sensor (acceptable)');
tm.destroy();

const gm = new GpuMonitor();
const gpus = await gm.poll();
check('gpu', Array.isArray(gpus) && gpus.every(g => g.name && (g.utilization === null || inRange(g.utilization, 0, 100))),
    JSON.stringify(gpus));
gm.destroy();

const bm = new BluetoothMonitor();
const bt = await bm.poll();
check('bluetooth', bt && typeof bt.available === 'boolean' && Array.isArray(bt.devices), JSON.stringify(bt));
bm.destroy();

if (failures > 0)
    throw new Error(`${failures} check(s) failed`);
console.log('All smoke checks passed.');
