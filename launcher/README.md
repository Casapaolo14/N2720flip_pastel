# Sorbet Launcher: Nokia 2720 Flip (KaiOS 2.5.2)

A homescreen in the Sorbet Brutalism style (`../sorbet-brutalism-guidelines.md`) as a 3-wide grid of pastel tiles. The header shows the date and battery %; the time is already in the status bar.

| Key | Action |
|-----|--------|
| D-pad | Move focus |
| Enter | Open the focused app |
| `0`–`9`, `*`, `#` | Open the Sorbet dial panel and keep typing the number |
| Back / SoftRight (in the panel) | Delete the last digit. Back on an empty number closes the panel. |
| Enter / Call (in the panel) | Hand the number to the stock "Call <number>?" dialog, then press Call again. The stock dialog handles SIM choice, emergency numbers and `*#` codes. |
| SoftLeft / SoftRight | Notices (or Messages) / Contacts |

**Desktop preview:** open `index.html` in Firefox, press Ctrl+Shift+M and set the size to 240×320. Mock apps and a mock 87% battery appear in place of real ones; Enter and number keys log `launch …` / `dial …` to the console (Ctrl+Shift+K). For an engine closer to the phone (Gecko 56 vs the phone's 48), open it in Waterfox Classic instead: `GDK_BACKEND=x11 ~/kaios-tools/waterfox-classic/waterfox -no-remote -profile ~/kaios-tools/wf-profile ~/Desktop/N2720flip_pastel/launcher/index.html`.

## Editing the homescreen
1. Edit the files in this folder:
   - `style.css`: the look (colours, tile size, glitter).
   - `launcher.js`: the keys and which apps are hidden (`HIDDEN_ROLES`).
   - `index.html`: the header and softkey bar.
2. Preview the change on desktop (see above).
3. Phone on USB, then run `./deploy.sh`. It zips this folder and saves the installed version to `~/kaios-tools/backup/application.zip.prev`. Then it swaps the package on the phone over adb (root), checks the checksum, and restarts the phone UI (about 20 s).
   - To roll back: `adb root && adb shell stop b2g && adb push ~/kaios-tools/backup/application.zip.prev /data/local/webapps/sorbet-launcher/application.zip && adb shell start b2g`.
   - If you change `manifest.webapp` **permissions**, reinstall once with WebIDE (step 6 below) instead, because the phone stores permissions at install time.

Firmware limits (Gecko 48): no CSS grid, no `clamp()`, no flex `gap`, no `:focus-visible`, no async/await. Gecko 48 drops a whole rule if one selector in it is unknown.

---

## Tested flash record
This exact process worked on **2026-11-06**:
- Phone: Nokia 2720 Flip, KaiOS 2.5.2, `ro.build.display.id=MMB29M dev-keys`, platform msm8909 / MSM8905.
- EDL: HWID `0x000940e100420050`, PK_HASH `77101cea…`.
- PC: Debian 13 (kernel 6.12), Wayland.
- Original boot: 26,165,248 bytes, sha256 `ec78d4c23319b95488a9227ad66191ebde33beec35fad80fa690bc325c130c48`.
- Patched boot sha256: `c0a69387e5956fa26b341a293175c2016b03d38eaa328b9b420296893d64e868`. This hash only matches if you start from the same original boot.

Short version:
1. ModemManager and `qcserial` off.
2. `adb reboot edl`, back up with andybalholm edl `-r`.
3. Patch the copy with 8k-boot-patcher (on a bookworm base).
4. Full reset (unplug USB, pull the battery), `adb reboot edl`, flash with `-w`.
5. Full reset, then `adb root`.
6. Edit `prefs.js` with b2g stopped.
7. Waterfox Classic WebIDE (X11) → install → set `homescreen.manifestURL`.

Things that did **not** work, so don't retry them: bkerler edl 3.62 and 3.52.1 (both hang right after the loader upload); the `*`+`#` key combo for EDL (use `adb reboot edl`); a battery pull with USB still plugged in (the phone stays in EDL); Waterfox on Wayland (segfaults).

---

## Root and install, step by step

> ⚠️ This flashes your phone's boot partition. A mistake can leave the phone unbootable until you restore the backup. A broken homescreen can leave you on a blank screen. Read every step before you start, and **keep the original `boot.img` safe**. Check file names and links against the [BananaHackers wiki](https://wiki.bananahackers.net/) (Nokia 2720 Flip page) before flashing, because they change over time.

### 1. Back up
- Export contacts (Contacts → Options → Settings → Export → Memory card) and anything else you care about.
- Charge the phone above 50%.

### 2. Enable debug mode
- On the home screen, dial `*#*#33284#*#*`. A small bug icon appears in the status bar.
- Go to Settings → Device → Developer, and set Debugger to **ADB and DevTools**.

### 3. Install the PC tools (Debian, tested)
```sh
sudo apt install -y adb fastboot libusb-1.0-0 libdbus-glib-1-2 docker.io
mkdir -p ~/kaios-tools && cd ~/kaios-tools
# andybalholm's edl fork: bkerler's edl 3.52/3.62 hang after the loader upload on this phone
curl -L -o andy.zip https://github.com/andybalholm/edl/archive/refs/heads/master.zip
python3 -c "import zipfile;zipfile.ZipFile('andy.zip').extractall('.')" && mv edl-master edl-andy
curl -L -o edl-andy/2720.mbn https://edl.bananahackers.net/loaders/2720.mbn
python3 -m venv venv-andy && . venv-andy/bin/activate && pip install pyusb pyserial capstone keystone-engine
sudo cp edl-andy/51-edl.rules edl-andy/50-android.rules /etc/udev/rules.d/ && sudo udevadm control -R && sudo udevadm trigger
adb devices        # the phone must be listed
```
**Linux gotcha:** ModemManager and the `qcserial` driver grab the phone in EDL mode, and reads hang. Turn both off while you work:
```sh
sudo systemctl stop ModemManager && sudo systemctl mask --runtime ModemManager
echo "blacklist qcserial" | sudo tee /etc/modprobe.d/blacklist-qcserial.conf && sudo modprobe -r qcserial
```

### 4. Root via EDL
EDL only accepts one session at a time. **Between sessions, do a full reset: unplug USB, pull the battery, put it back, hold power, then plug back in.** If USB stays connected, the phone stays powered and stuck in EDL.

1. Boot the phone normally with the cable connected, then run `adb reboot edl`. The screen goes black, and `lsusb` shows `05c6:9008`.
2. Back up boot (about 25 MB; the file must start with `ANDROID!`):
   ```sh
   cd ~/kaios-tools/edl-andy && . ../venv-andy/bin/activate
   python edl.py -r boot ~/kaios-tools/boot.ORIGINAL.img -loader 2720.mbn
   chmod 444 ~/kaios-tools/boot.ORIGINAL.img      # keep it forever, and keep a copy off the PC
   ```
3. Patch a copy with Luxferre's **8k-boot-patcher**, which supports the 2720 Flip. Its Dockerfile uses Debian Buster, which is dead, so switch the base image first:
   ```sh
   cd ~/kaios-tools && git clone https://gitlab.com/suborg/8k-boot-patcher.git && cd 8k-boot-patcher
   sed -i 's#^FROM python:3.9-slim-buster#FROM debian:bookworm-slim#' Dockerfile && docker build -t 8kbootpatcher .
   mkdir -p ~/kaios-tools/work && cp ~/kaios-tools/boot.ORIGINAL.img ~/kaios-tools/work/boot.img && chmod 644 ~/kaios-tools/work/boot.img
   docker run --rm -v ~/kaios-tools/work:/image 8kbootpatcher
   ```
   This sets `ro.secure=0`, `ro.debuggable=1` and SELinux permissive, and adds a root `adbd`.
4. Do a full reset, `adb reboot edl`, then flash:
   ```sh
   python edl.py -w boot ~/kaios-tools/work/boot.img -loader 2720.mbn
   ```
5. Do a full reset (unplug USB first!) and power on. Then check:
   ```sh
   adb root && adb shell id                       # uid=0(root)
   adb shell cat /proc/cmdline | grep -o enforcing=0
   ```
   `getenforce` says "Enforcing" on purpose. The patcher fakes that status for apps; the kernel is really permissive.

### 5. Allow certified apps
b2g rewrites `prefs.js` on exit, so stop it first:
```sh
adb shell ls /data/b2g/mozilla/                  # e.g. wgd9fis7.default
P=/data/b2g/mozilla/wgd9fis7.default/prefs.js
adb pull $P ~/kaios-tools/backup/prefs.js
adb shell stop b2g
adb shell "echo 'user_pref(\"devtools.apps.forbidden-permissions\", \"\");' >> $P; echo 'user_pref(\"devtools.debugger.forbid-certified-apps\", false);' >> $P"
adb shell start b2g
```

### 6. Install the launcher (Waterfox Classic WebIDE)
```sh
cd ~/kaios-tools
curl -LO https://github.com/BrowserWorks/Waterfox-Classic/releases/download/2022.11-classic/waterfox-classic-2022.11.en-US.linux-x86_64.tar.bz2
tar xjf waterfox-classic-*.tar.bz2 && mkdir -p wf-profile
adb forward tcp:6000 localfilesystem:/data/local/debugger-socket
# on Wayland it segfaults unless forced to X11
GDK_BACKEND=x11 MOZ_ENABLE_WAYLAND=0 ./waterfox-classic/waterfox -no-remote -profile wf-profile &
```
Shift+F8 (WebIDE) → Select Runtime → Remote Runtime `localhost:6000` → Open App → Open Packaged App → this `launcher/` folder → ▶ Install and Run.

### 7. Make it the homescreen
WebIDE → left panel → **Main Process** → Console:
```js
navigator.mozSettings.createLock().set({'homescreen.manifestURL': 'app://sorbet-launcher/manifest.webapp'})
```
Press End. To reinstall after editing the code, click ▶ again in the WebIDE.

### 8. Undo / recovery
- **Back to the stock launcher** (same console):
  ```js
  navigator.mozSettings.createLock().set({'homescreen.manifestURL': 'app://launcher.gaiamobile.org/manifest.webapp'})
  ```
- **Uninstall:** switch the homescreen back first, then WebIDE → the app → Uninstall.
- **Un-root / phone won't boot:** full reset, enter EDL (hold `*` + `#` while plugging in, or `adb reboot edl`), then run `python edl.py -w boot ~/kaios-tools/boot.ORIGINAL.img -loader 2720.mbn`.
- **PC cleanup when you're done:** `sudo systemctl unmask --runtime ModemManager && sudo systemctl start ModemManager` and `sudo rm /etc/modprobe.d/blacklist-qcserial.conf`.
