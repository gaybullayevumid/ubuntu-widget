import {CommandRunner, commandExists} from '../services/command-runner.js';
import {listDir, readNumber, readText} from '../services/system-info.js';

const DRM = '/sys/class/drm';
const MIB = 1024 * 1024;

const VENDOR_NVIDIA = '0x10de';
const VENDOR_AMD = '0x1002';
const VENDOR_INTEL = '0x8086';

function emptyGpu(vendor, name) {
    return {vendor, name, utilization: null, temperature: null, vramUsed: null, vramTotal: null, frequencyMHz: null, note: null};
}

function hwmonTemperature(deviceDir) {
    for (const dir of listDir(`${deviceDir}/hwmon`)) {
        const t = readNumber(`${deviceDir}/hwmon/${dir}/temp1_input`);
        if (t !== null)
            return t / 1000;
    }
    return null;
}

function drmDevices() {
    return listDir(DRM).filter(n => /^card\d+$/.test(n)).map(card => ({
        card,
        dir: `${DRM}/${card}/device`,
        vendor: readText(`${DRM}/${card}/device/vendor`),
    }));
}

function pollAmd(dev) {
    const gpu = emptyGpu('AMD', readText(`${dev.dir}/product_name`) ?? 'AMD GPU');
    gpu.utilization = readNumber(`${dev.dir}/gpu_busy_percent`);
    gpu.vramUsed = readNumber(`${dev.dir}/mem_info_vram_used`);
    gpu.vramTotal = readNumber(`${dev.dir}/mem_info_vram_total`);
    gpu.temperature = hwmonTemperature(dev.dir);
    if (gpu.utilization === null)
        gpu.note = 'Utilization not exposed by the amdgpu driver';
    return gpu;
}

function pollIntel(dev) {
    const gpu = emptyGpu('Intel', 'Intel integrated graphics');
    const cardDir = `${DRM}/${dev.card}`;
    gpu.frequencyMHz = readNumber(`${cardDir}/gt_act_freq_mhz`) ?? readNumber(`${cardDir}/gt_cur_freq_mhz`);
    gpu.temperature = hwmonTemperature(dev.dir);
    gpu.note = 'Utilization needs intel_gpu_top with elevated privileges; not available without root';
    return gpu;
}

export class GpuMonitor {
    constructor() {
        this._runner = new CommandRunner();
        this._nvidiaName = null;
    }

    /**
     * @returns {Promise<Array<object>>} one entry per detected GPU; empty if none found.
     * Fields that cannot be measured are null (never guessed).
     */
    async poll() {
        const gpus = [];
        const nvidiaDevices = [];
        for (const dev of drmDevices()) {
            if (dev.vendor === VENDOR_AMD)
                gpus.push(pollAmd(dev));
            else if (dev.vendor === VENDOR_INTEL)
                gpus.push(pollIntel(dev));
            else if (dev.vendor === VENDOR_NVIDIA)
                nvidiaDevices.push(dev);
        }
        if (nvidiaDevices.length > 0)
            gpus.unshift(...await this._pollNvidia(nvidiaDevices));
        return gpus;
    }

    async _pollNvidia(devices) {
        if (!commandExists('nvidia-smi')) {
            const gpu = emptyGpu('NVIDIA', 'NVIDIA GPU');
            gpu.note = 'nvidia-smi not found (install the NVIDIA driver utilities)';
            return [gpu];
        }

        // On hybrid laptops the dGPU sleeps when idle; running nvidia-smi would wake it
        // and defeat power saving, so report it as suspended instead.
        const statuses = devices.map(d => readText(`${d.dir}/power/runtime_status`));
        if (statuses.every(s => s === 'suspended')) {
            const gpu = emptyGpu('NVIDIA', this._nvidiaName ?? 'NVIDIA GPU');
            gpu.note = 'Suspended (idle); not queried to avoid waking it';
            gpu.suspended = true;
            return [gpu];
        }

        const out = await this._runner.run([
            'nvidia-smi',
            '--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total',
            '--format=csv,noheader,nounits',
        ]);
        if (!out) {
            const gpu = emptyGpu('NVIDIA', this._nvidiaName ?? 'NVIDIA GPU');
            gpu.note = 'nvidia-smi failed (driver not loaded?)';
            return [gpu];
        }

        const num = s => {
            const v = parseFloat(s);
            return Number.isFinite(v) ? v : null;
        };
        const gpus = [];
        for (const line of out.trim().split('\n')) {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length < 5)
                continue;
            const tail = parts.splice(-4);
            const gpu = emptyGpu('NVIDIA', parts.join(', '));
            gpu.utilization = num(tail[0]);
            gpu.temperature = num(tail[1]);
            const used = num(tail[2]);
            const total = num(tail[3]);
            gpu.vramUsed = used === null ? null : used * MIB;
            gpu.vramTotal = total === null ? null : total * MIB;
            this._nvidiaName = gpu.name;
            gpus.push(gpu);
        }
        return gpus;
    }

    destroy() {
        this._runner.destroy();
    }
}
