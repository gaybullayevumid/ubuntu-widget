# System Monitor Top Bar

A GNOME Shell extension for the Ubuntu top bar: compact CPU, RAM, temperature, GPU and uptime
indicators, with a dropdown showing details and Bluetooth device battery levels.

Developed against **Ubuntu 26.10, GNOME Shell 51.0 (Wayland), GJS 1.90**. `metadata.json` declares only
shell version 51, since that is the only version it was written against. GNOME 45+ uses the same ES-module
extension format, so other versions may work: add them to `shell-version` and test.

## Project layout

```text
metadata.json            extension metadata (uuid, shell-version, settings-schema)
extension.js             entry point: creates the panel button and the polling hub, tears both down on disable
prefs.js                 Adwaita preferences window
stylesheet.css           panel styling
schemas/                 GSettings schema (indicator toggles, intervals, temperature unit)
src/monitors/            cpu, memory, temperature, gpu, uptime, bluetooth: one data source each, no UI
src/services/            system-info.js   procfs/sysfs readers shared by monitors
                         monitor-hub.js   owns monitors and timers, produces one snapshot object
                         command-runner.js async, shell-free subprocess runner (timeout + cancel)
                         dbus.js          async D-Bus call helper and signal-subscription tracker
src/ui/                  topbar.js (panel button), dropdown.js (menu), device-row.js (Bluetooth row)
src/utils/               formatting.js, logging.js
scripts/                 install.sh, uninstall.sh, validate.sh (common.sh is sourced by all three)
tests/                   smoke.js (standalone monitor test) and README.md
```

Deviations from the requested layout: `src/services/monitor-hub.js`, `scripts/common.sh` and
`tests/smoke.js` were added. The hub is separate from `system-info.js` because the monitors import the
readers, and putting both in one file would create a circular import.

## Features and limitations

| Metric | Source | Limitations |
|---|---|---|
| CPU % | `/proc/stat` (delta between samples) | Total across all cores. |
| RAM | `/proc/meminfo`: used = `MemTotal − MemAvailable` | None. |
| Temperature | hwmon sysfs (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`), then thermal zones (`x86_pkg_temp`, `acpitz`), then `sensors -j` if lm-sensors is installed | Shows "N/A" if no sensor is found. `lm-sensors` is optional. |
| GPU, NVIDIA | `nvidia-smi` (name, utilization, temperature, VRAM) | Needs the NVIDIA driver utilities. On hybrid laptops, a runtime-suspended dGPU is **not queried** (that would wake it); it is shown as "idle"/suspended. |
| GPU, AMD | amdgpu sysfs (`gpu_busy_percent`, `mem_info_vram_*`, hwmon temp) | Untested here (no AMD hardware). |
| GPU, Intel | name, current frequency, hwmon temperature if exposed | **No utilization**: the kernel exposes none without root (`intel_gpu_top`). Shown as unavailable, never estimated. |
| Bluetooth battery | BlueZ `Battery1` first, then a UPower device whose serial/path matches the MAC | Only devices that report battery to BlueZ or UPower; others show "Battery N/A". Updates on D-Bus signals (debounced) plus a fallback timer. |
| Uptime | `/proc/uptime` | Counts from boot, including time spent suspended. |

Unavailable values are displayed as `N/A`, with a reason in the dropdown where one is known.

## Dependencies (Ubuntu)

Required (already present on a standard Ubuntu desktop): `gnome-shell`, `gjs`, `libglib2.0-bin`
(`glib-compile-schemas`), `python3` (used by the scripts), `bluez`, `upower`.

Optional:

```bash
sudo apt install lm-sensors           # temperature fallback only if hwmon is unavailable
# NVIDIA: nvidia-smi ships with the driver, e.g.  sudo apt install nvidia-utils-<version>
```

## Install and enable

```bash
bash scripts/validate.sh                      # optional pre-check
bash scripts/install.sh                       # copies to ~/.local/share/gnome-shell/extensions/system-monitor@ubuntu-widget
```

Then make GNOME Shell discover it: **log out and back in** (Wayland), or on X11 press `Alt+F2`, type `r`, Enter.

```bash
gnome-extensions enable system-monitor@ubuntu-widget
```

## Configure and use

Click the indicators to open the dropdown (details + Bluetooth devices). Open settings from the dropdown's
**Settings** item, or:

```bash
gnome-extensions prefs system-monitor@ubuntu-widget
```

Options: toggle each indicator (disabled ones are not polled), refresh intervals (1–10 s for CPU/RAM/temp/uptime,
1–30 s for GPU, 5–300 s Bluetooth fallback), temperature unit (°C/°F). If every indicator is disabled, a small
icon remains so the menu stays reachable.

## Disable, update, uninstall

```bash
gnome-extensions disable system-monitor@ubuntu-widget     # disable
bash scripts/install.sh                                   # update: re-copy, then log out/in (Wayland)
bash scripts/uninstall.sh                                 # disable and remove only this extension's directory
dconf reset -f /org/gnome/shell/extensions/systemmonitor/ # optional: forget saved settings
```

## Logs and troubleshooting

```bash
journalctl -f -o cat /usr/bin/gnome-shell                 # live shell log (look for "[system-monitor]" and JS ERROR)
journalctl -b -o cat /usr/bin/gnome-shell | grep -iE 'system-monitor|JS ERROR'
gnome-extensions info system-monitor@ubuntu-widget        # state: ENABLED / ERROR / OUT OF DATE
gnome-extensions show system-monitor@ubuntu-widget
```

- **Not listed / "does not exist"**: you have not logged out and in since installing (Wayland).
- **State OUT OF DATE**: your GNOME Shell major version is not in `metadata.json` `shell-version`.
- **Schema errors**: re-run `scripts/install.sh` (it recompiles the schema in the installed copy).
- **Temperature N/A**: `ls /sys/class/hwmon/*/name`; install `lm-sensors` and run `sudo sensors-detect`.
- **GPU shows `idle`**: the NVIDIA dGPU is runtime-suspended; it will be queried once something wakes it.

## Testing each monitor

Standalone, without touching the shell: `gjs -m tests/smoke.js` prints real values for every monitor.
In the live shell, compare the indicators against an independent tool:

- **CPU**: run `yes > /dev/null &` per core (then `kill %1 …`); the indicator should rise towards 100 %. Compare with `top`.
- **RAM**: compare with `free -m` ("used"/"total"); run `tail /dev/zero` briefly (it consumes memory until killed, so stop it with Ctrl+C within a few seconds) and watch it grow.
- **Temperature**: compare with `sensors` or `cat /sys/class/hwmon/hwmon*/temp*_input` (millidegrees); change the unit in settings.
- **GPU**: NVIDIA: compare with `nvidia-smi`; load it with e.g. `glxgears` run on the dGPU (`prime-run glxgears`).
- **Uptime**: compare with `uptime -p` or `cat /proc/uptime`.
- **Bluetooth battery**: connect a device, open the dropdown. Cross-check with `upower -d | grep -A12 -i bluetooth` or
  `busctl --system tree org.bluez` plus `busctl get-property org.bluez <device-path> org.bluez.Battery1 Percentage`.
  Disconnect the device: its row should disappear within about a second. Turn Bluetooth off: the menu shows "Bluetooth is turned off".

## Cleanup behaviour

`disable()` destroys the panel button, removes every GLib timer, disconnects the settings handler,
unsubscribes all D-Bus signals, cancels pending D-Bus calls and kills any running subprocess.

## License

GPL-3.0-or-later; see `LICENSE`.
