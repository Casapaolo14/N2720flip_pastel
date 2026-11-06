#!/bin/sh
# Install this folder on the rooted phone as the Sorbet Launcher update, then restart the phone UI.
# Only for updates of an app already installed once via WebIDE. If manifest.webapp permissions change,
# reinstall with WebIDE instead: webapps.json keeps the permissions from the first install.
set -e
cd "$(dirname "$0")"
DIR=/data/local/webapps/sorbet-launcher
BACKUP=~/kaios-tools/backup/application.zip.prev
ZIP=$(mktemp --suffix=.zip)
trap 'rm -f "$ZIP"' EXIT

adb get-state >/dev/null                      # fails fast if the phone isn't connected
adb root >/dev/null && adb wait-for-device
adb shell "test -f $DIR/application.zip" || { echo "Sorbet Launcher isn't installed yet: install it once with WebIDE."; exit 1; }

rm -f "$ZIP" && zip -qrX "$ZIP" manifest.webapp index.html style.css launcher.js fonts icons
mkdir -p "$(dirname "$BACKUP")" && adb pull "$DIR/application.zip" "$BACKUP" >/dev/null
echo "Previous version saved to $BACKUP"

adb shell stop b2g                            # b2g holds the old package open; stop it before swapping
adb push "$ZIP" "$DIR/application.zip" >/dev/null
adb push manifest.webapp "$DIR/manifest.webapp" >/dev/null
adb shell "chmod 600 $DIR/application.zip $DIR/manifest.webapp"

[ "$(adb shell md5sum $DIR/application.zip | cut -d' ' -f1)" = "$(md5sum "$ZIP" | cut -d' ' -f1)" ] \
  || { echo "Checksum mismatch after push; restarting UI with whatever is there." >&2; adb shell start b2g; exit 1; }
adb shell start b2g
echo "Deployed. The phone UI is restarting (about 20 s)."
