# Android emulator runbook

How to boot the `Medium_Phone_API_37.0` emulator on this Windows machine and run the app on it, without trial and error. Proven 2026-11-02 (boots in about 60 seconds).

## Setup facts

- SDK: `%LOCALAPPDATA%\Android\Sdk` (installed with Android Studio). `adb` is on the PATH. The emulator is at `%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe`.
- AVD: `Medium_Phone_API_37.0` (Android 37, Google Play image, x86_64, 1080x2400, density 420). Its files are in `%USERPROFILE%\.android\avd\Medium_Phone.avd`.
- Acceleration: WHPX (Windows Hypervisor Platform) works. Check with `emulator -accel-check`.
- Agent sessions run behind a corporate proxy: `HTTP_PROXY` and `HTTPS_PROXY` point at `http://9.208.146.33:3128`, and `NO_PROXY` is not set.

## Why it used to hang

The emulator talks to its own network and Bluetooth helper (`netsimd`) over gRPC on `127.0.0.1`. gRPC obeys the proxy variables, so with no `NO_PROXY` that local connection goes to the proxy and fails. You see this:

- `adb devices` shows `emulator-5554 offline` and never changes.
- The emulator log shows `netsim startup` again every 18 seconds.
- `%TEMP%\netsimd\netsim_stderr.log` ends with `Startup timeout reached (no devices connected), initiating shutdown`.

Changing the graphics mode does not help. A `-gpu swiftshader_indirect` attempt crashed with exit code 139. When you start the emulator from Android Studio, the proxy variables are usually not set, so it boots there without this fix.

## Steps (agent, Git Bash)

1. Make sure no emulator is running, then clear stale locks left by a killed or crashed run. They are safe to delete only when no emulator is running.
   ```bash
   tasklist | grep -i -E "qemu|emulator.exe" || echo "none running"
   A="$USERPROFILE/.android/avd/Medium_Phone.avd"
   rm -f "$A/multiinstance.lock"; rm -rf "$A/hardware-qemu.ini.lock"
   ```
2. Start the emulator in the background with localhost excluded from the proxy:
   ```bash
   export NO_PROXY="localhost,127.0.0.1,::1,10.0.2.2" no_proxy="localhost,127.0.0.1,::1,10.0.2.2"
   "$LOCALAPPDATA/Android/Sdk/emulator/emulator" -avd Medium_Phone_API_37.0 -no-snapshot-load -no-boot-anim
   ```
3. Wait for the boot to finish (about 60 seconds):
   ```bash
   for i in $(seq 1 90); do b=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r'); [ "$b" = "1" ] && break; sleep 3; done; echo boot=$b; adb devices
   ```
   Expect `boot=1` and `emulator-5554 device`. If it stays `offline`, look at step 2 first: the proxy is the usual cause.

## Run the app in Expo Go

- Port 8081 is often taken by another dev server, so use 8082: `npx expo start --android --port 8082`. Expo Go (`host.exp.exponent`) is already installed on the emulator. The first bundle takes about 1.5 minutes; after that it takes about 30 seconds.
- On first launch the icon font loads a few seconds after the screen appears, so wait before judging missing icons.
- To reopen the app: `adb shell am start -a android.intent.action.VIEW -d exp://192.168.254.120:8082` (the LAN URL Metro prints). If Expo Go shows a blank screen and Metro logs `Cannot find native module 'ExpoSQLite'`, Expo Go is in a bad state: run `adb shell am force-stop host.exp.exponent` and open the URL again. Do not use `exp://127.0.0.1:8082`; it triggered this error.
- On the office network (192.168.x LAN address gone, emulator has no DNS), the LAN URL does not apply and `exp://10.0.2.2:8082` fails: Expo Go shows "Something went wrong" after 60 seconds, its error log says `Failed to download remote update` (a socket connect timeout), and Metro never receives a request. What works (2026-11-07): `adb reverse tcp:8082 tcp:8082`, then `adb shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8082`. With the reverse in place, 127.0.0.1 loaded cleanly. Git Bash rewrites `/sdcard/...` paths in adb arguments; prefix such commands with `MSYS_NO_PATHCONV=1`.
- Changing density or font scale restarts the app on Home, so set them before you navigate.
- The AVD has a hardware keyboard turned on (`hw.keyboard=yes`), so the on-screen keyboard does not pop up when a field gets focus; it appears once text is typed. Check autofocus keyboard behavior on a real phone.

## Device checks at 360dp and 1.3 font scale

- 360dp width: `adb shell wm density 480` (1080 px / 3 = 360dp). Undo with `adb shell wm density reset`.
- 1.3 font scale: `adb shell settings put system font_scale 1.3`. Undo with `adb shell settings put system font_scale 1.0`.
- Always undo both when you finish.

## Useful commands

- Screenshot: `adb exec-out screencap -p > shot.png`
- Light or dark mode: `adb shell cmd uimode night no` and `adb shell cmd uimode night yes` (the app switches live)
- Tap and scroll, in screen pixels (1080x2400): `adb shell input tap X Y` and `adb shell input swipe 540 1900 540 600 600`
- Open a deep link: `adb shell am start -a android.intent.action.VIEW -d kanjisrs://dev/ui`
- Install an APK: `adb install -r path/to/app.apk`
- Shut down: `adb -s emulator-5554 emu kill`
- Fire a scheduled reminder now: find its time with `adb shell dumpsys alarm | grep -A3 kanjisrs`, then run `adb shell settings put global auto_time 0` and `adb shell cmd alarm set-time <ms>` with a time past the end of the alarm's window. Undo with `adb shell settings put global auto_time 1`.

## Known quirks

- The API 37 image draws some icons as solid black. This includes the Calendar icon in the app drawer and the app icon at the left of a notification in the shade, where Android 17 shows the app's launcher icon, not the notification icon. The status bar shows the real notification icon. Judge icons on a phone.

## Optional fixes

- To make the fix permanent for every tool, add a Windows user environment variable `NO_PROXY=localhost,127.0.0.1,::1`.
- The AVD asks for 11 CPU cores (`hw.cpu.ncore=11` in `config.ini`) and the emulator caps it at 6 with a warning. Setting it to 6 removes the warning. It is harmless either way.
- Downloading an EAS APK through the proxy runs at about 1 MB a minute. For a quick check, Expo Go is faster.
