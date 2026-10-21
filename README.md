# System Monitor Top Bar

Ubuntu yuqori paneli (top bar) uchun GNOME Shell kengaytmasi: CPU, RAM, harorat, GPU va ishlash vaqti (uptime) uchun ixcham ko'rsatkichlar, hamda ochiladigan menyuda batafsil ma'lumot va Bluetooth qurilmalar batareya darajasi.

**Ubuntu 26.10, GNOME Shell 51.0 (Wayland), GJS 1.90** uchun ishlab chiqilgan. `metadata.json` faqat 51-versiyani e'lon qiladi, chunki kengaytma faqat shu versiyaga qarab yozilgan. GNOME 45+ bir xil ES-modul formatidan foydalanadi, shuning uchun boshqa versiyalarda ham ishlashi mumkin: ularni `shell-version` ga qo'shing va sinab ko'ring.

(Inglizcha asl nusxa: `README.en.md`)

## Loyiha tuzilmasi

```text
metadata.json            kengaytma metama'lumotlari (uuid, shell-version, settings-schema)
extension.js             kirish nuqtasi: panel tugmasi va so'rov markazini yaratadi, o'chirilganda ikkalasini tozalaydi
prefs.js                 Adwaita sozlamalar oynasi
stylesheet.css           panel uslublari
schemas/                 GSettings sxemasi (ko'rsatkichlarni yoqish/o'chirish, intervallar, harorat birligi)
src/monitors/            cpu, memory, temperature, gpu, uptime, bluetooth: har biri bitta ma'lumot manbai, UI yo'q
src/services/            system-info.js    monitorlar uchun umumiy procfs/sysfs o'qish funksiyalari
                         monitor-hub.js    monitorlar va taymerlarga egalik qiladi, bitta snapshot obyektini yaratadi
                         command-runner.js asinxron, shell'siz jarayon ishga tushirgich (timeout + bekor qilish)
                         dbus.js           asinxron D-Bus chaqiruvi va signal obunalarini kuzatuvchi
src/ui/                  topbar.js (panel tugmasi), dropdown.js (menyu), device-row.js (Bluetooth qatori)
src/utils/               formatting.js, logging.js
scripts/                 install.sh, uninstall.sh, validate.sh (common.sh uchalasiga ham ulanadi)
tests/                   smoke.js (mustaqil monitor testi) va README.md
```

So'ralgan tuzilmadan farqlar: `src/services/monitor-hub.js`, `scripts/common.sh` va `tests/smoke.js` qo'shildi. Hub `system-info.js` dan ajratilgan, chunki monitorlar o'quvchi funksiyalarni import qiladi va ikkalasini bitta faylga qo'yish doiraviy (circular) import hosil qilardi.

## Imkoniyatlar va cheklovlar

| Ko'rsatkich | Manba | Cheklovlar |
|---|---|---|
| CPU % | `/proc/stat` (namunalar orasidagi farq) | Barcha yadrolar bo'yicha umumiy. |
| RAM | `/proc/meminfo`: ishlatilgan = `MemTotal − MemAvailable` | Yo'q. |
| Harorat | hwmon sysfs (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`), so'ng thermal zone'lar (`x86_pkg_temp`, `acpitz`), so'ng lm-sensors o'rnatilgan bo'lsa `sensors -j` | Sensor topilmasa "N/A" ko'rsatiladi. `lm-sensors` majburiy emas. |
| GPU, NVIDIA | `nvidia-smi` (nom, yuklama, harorat, VRAM) | NVIDIA drayver utilitalari kerak. Gibrid noutbuklarda uxlab yotgan (runtime-suspended) dGPU'ga **so'rov yuborilmaydi** (bu uni uyg'otib yuborardi); u "idle"/to'xtatilgan deb ko'rsatiladi. |
| GPU, AMD | amdgpu sysfs (`gpu_busy_percent`, `mem_info_vram_*`, hwmon harorat) | Bu yerda sinalmagan (AMD uskuna yo'q). |
| GPU, Intel | nom, joriy chastota, mavjud bo'lsa hwmon harorati | **Yuklama yo'q**: yadro root'siz buni taqdim etmaydi (`intel_gpu_top`). Mavjud emas deb ko'rsatiladi, hech qachon taxmin qilinmaydi. |
| Bluetooth batareya | avval BlueZ `Battery1`, so'ng MAC manziliga mos keladigan UPower qurilmasi | Faqat BlueZ yoki UPower'ga batareya xabar qiladigan qurilmalar; qolganlari "Battery N/A" ko'rsatadi. D-Bus signallari (kechiktirilgan) va zaxira taymer orqali yangilanadi. |
| Uptime | `/proc/uptime` | Yuklanishdan boshlab hisoblanadi, uyqu (suspend) vaqti ham kiradi. |

Mavjud bo'lmagan qiymatlar `N/A` deb ko'rsatiladi, sababi ma'lum bo'lsa menyuda yoziladi.

## Bog'liqliklar (Ubuntu)

Majburiy (oddiy Ubuntu desktop'da mavjud): `gnome-shell`, `gjs`, `libglib2.0-bin` (`glib-compile-schemas`), `python3` (skriptlar ishlatadi), `bluez`, `upower`.

Ixtiyoriy:

```bash
sudo apt install lm-sensors           # faqat hwmon mavjud bo'lmaganda harorat uchun zaxira
# NVIDIA: nvidia-smi drayver bilan keladi, masalan:  sudo apt install nvidia-utils-<versiya>
```

## O'rnatish va yoqish

```bash
bash scripts/validate.sh                      # ixtiyoriy oldindan tekshiruv
bash scripts/install.sh                       # ~/.local/share/gnome-shell/extensions/system-monitor@ubuntu-widget ga ko'chiradi
```

So'ng GNOME Shell kengaytmani topishi uchun: **tizimdan chiqib qayta kiring** (Wayland), yoki X11'da `Alt+F2` bosib, `r` yozing va Enter bosing.

```bash
gnome-extensions enable system-monitor@ubuntu-widget
```

## Sozlash va ishlatish

Ko'rsatkichlarni bosib menyuni oching (tafsilotlar + Bluetooth qurilmalar). Sozlamalarni menyudagi **Settings** bandidan yoki quyidagi buyruq bilan oching:

```bash
gnome-extensions prefs system-monitor@ubuntu-widget
```

Variantlar: har bir ko'rsatkichni yoqish/o'chirish (o'chirilganlar so'rov qilinmaydi), yangilanish intervallari (CPU/RAM/harorat/uptime uchun 1–10 s, GPU uchun 1–30 s, Bluetooth zaxirasi uchun 5–300 s), harorat birligi (°C/°F). Agar barcha ko'rsatkichlar o'chirilsa, menyuga kirish imkoni qolishi uchun kichik belgi ko'rinib turadi.

## O'chirish, yangilash, olib tashlash

```bash
gnome-extensions disable system-monitor@ubuntu-widget     # o'chirish
bash scripts/install.sh                                   # yangilash: qayta ko'chiring, so'ng chiqib-kiring (Wayland)
bash scripts/uninstall.sh                                 # o'chiradi va faqat shu kengaytmaning papkasini olib tashlaydi
dconf reset -f /org/gnome/shell/extensions/systemmonitor/ # ixtiyoriy: saqlangan sozlamalarni tozalash
```

## Loglar va muammolarni hal qilish

```bash
journalctl -f -o cat /usr/bin/gnome-shell                 # jonli shell logi ("[system-monitor]" va JS ERROR ni qidiring)
journalctl -b -o cat /usr/bin/gnome-shell | grep -iE 'system-monitor|JS ERROR'
gnome-extensions info system-monitor@ubuntu-widget        # holat: ENABLED / ERROR / OUT OF DATE
gnome-extensions show system-monitor@ubuntu-widget
```

- **Ro'yxatda yo'q / "does not exist"**: o'rnatgandan keyin tizimdan chiqib-kirmagansiz (Wayland).
- **Holat OUT OF DATE**: GNOME Shell asosiy versiyangiz `metadata.json` dagi `shell-version` ichida yo'q.
- **Sxema xatolari**: `scripts/install.sh` ni qayta ishga tushiring (u o'rnatilgan nusxada sxemani qayta kompilyatsiya qiladi).
- **Harorat N/A**: `ls /sys/class/hwmon/*/name` ni tekshiring; `lm-sensors` o'rnating va `sudo sensors-detect` ni ishga tushiring.
- **GPU `idle` ko'rsatadi**: NVIDIA dGPU uxlab yotibdi; biror narsa uni uyg'otganda so'rov qilinadi.

## Har bir monitorni sinash

Shell'ga tegmasdan mustaqil: `gjs -m tests/smoke.js` har bir monitor uchun haqiqiy qiymatlarni chiqaradi. Jonli shell'da ko'rsatkichlarni mustaqil vosita bilan solishtiring:

- **CPU**: har bir yadro uchun `yes > /dev/null &` ishga tushiring (keyin `kill %1 …`); ko'rsatkich 100 % ga qarab ko'tarilishi kerak. `top` bilan solishtiring.
- **RAM**: `free -m` ("used"/"total") bilan solishtiring; `tail /dev/zero` ni qisqa vaqt ishga tushiring (to'xtatilmaguncha xotirani yeydi, shuning uchun bir necha soniyada Ctrl+C bilan to'xtating) va o'sishini kuzating.
- **Harorat**: `sensors` yoki `cat /sys/class/hwmon/hwmon*/temp*_input` (millidaraja) bilan solishtiring; sozlamalarda birlikni o'zgartiring.
- **GPU**: NVIDIA: `nvidia-smi` bilan solishtiring; dGPU'da `prime-run glxgears` kabi narsa bilan yuklang.
- **Uptime**: `uptime -p` yoki `cat /proc/uptime` bilan solishtiring.
- **Bluetooth batareya**: qurilmani ulang va menyuni oching. `upower -d | grep -A12 -i bluetooth` yoki `busctl --system tree org.bluez` va `busctl get-property org.bluez <device-path> org.bluez.Battery1 Percentage` bilan tekshiring. Qurilmani uzing: uning qatori taxminan bir soniyada yo'qolishi kerak. Bluetooth'ni o'chiring: menyuda "Bluetooth is turned off" chiqadi.

## Tozalash xatti-harakati

`disable()` panel tugmasini yo'q qiladi, barcha GLib taymerlarini olib tashlaydi, sozlamalar handler'ini uzadi, barcha D-Bus signal obunalarini bekor qiladi, kutilayotgan D-Bus chaqiruvlarini to'xtatadi va ishlayotgan barcha jarayonlarni o'chiradi.

## Litsenziya

GPL-3.0-or-later; `LICENSE` fayliga qarang.
