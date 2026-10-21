import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const UNITS = ['celsius', 'fahrenheit'];

export default class SystemMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;       // keep alive for the window's lifetime

        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'utilities-system-monitor-symbolic'});
        window.add(page);

        const indicators = new Adw.PreferencesGroup({
            title: 'Indicators',
            description: 'Disabled indicators are also not polled.',
        });
        page.add(indicators);
        for (const [key, title, subtitle] of [
            ['show-cpu', 'CPU usage', null],
            ['show-memory', 'RAM usage', null],
            ['show-temperature', 'CPU temperature', null],
            ['show-gpu', 'GPU', 'NVIDIA, AMD and Intel where supported'],
            ['show-uptime', 'Uptime', null],
            ['show-bluetooth', 'Bluetooth battery levels', 'Shown in the dropdown menu'],
        ]) {
            const row = new Adw.SwitchRow({title, subtitle: subtitle ?? ''});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            indicators.add(row);
        }

        const timing = new Adw.PreferencesGroup({title: 'Refresh intervals (seconds)'});
        page.add(timing);
        for (const [key, title, subtitle, min, max] of [
            ['refresh-interval', 'CPU, RAM, temperature, uptime', null, 1, 10],
            ['gpu-refresh-interval', 'GPU', 'Querying an NVIDIA GPU too often can cost power', 1, 30],
            ['bluetooth-refresh-interval', 'Bluetooth fallback', 'Changes are also applied instantly via D-Bus', 5, 300],
        ]) {
            const row = new Adw.SpinRow({
                title,
                subtitle: subtitle ?? '',
                adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: 1, page_increment: 5}),
            });
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            timing.add(row);
        }

        const units = new Adw.PreferencesGroup({title: 'Units'});
        page.add(units);
        const unitRow = new Adw.ComboRow({
            title: 'Temperature unit',
            model: Gtk.StringList.new(['Celsius (°C)', 'Fahrenheit (°F)']),
            selected: Math.max(0, UNITS.indexOf(settings.get_string('temperature-unit'))),
        });
        unitRow.connect('notify::selected', () => settings.set_string('temperature-unit', UNITS[unitRow.selected]));
        units.add(unitRow);
    }
}
