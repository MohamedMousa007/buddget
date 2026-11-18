#!/usr/bin/env bash
# Upload an APK to Google Drive and print a link to it.
# Usage: upload-apk.sh <apk-path>
# Requires: rclone configured with a remote named "buddget-drive"
# One-time setup: brew install rclone && rclone config (name the remote "buddget-drive")
#
# The link is always shared as "anyone with the link" (owner choice 2026-11-19). The APK is a debug-signed, debuggable
# build, so treat the link like the build itself: send it only to testers.
set -euo pipefail

APK="${1:?usage: upload-apk.sh <apk-path>}"
REMOTE="buddget-drive:buddget/APKs"
FILENAME="$(basename "$APK")"

[ -f "$APK" ] || { echo "Not a file: $APK" >&2; exit 1; }
[[ "$FILENAME" =~ ^[A-Za-z0-9._-]+\.apk$ ]] || { echo "Unexpected APK file name: $FILENAME" >&2; exit 1; }

rclone copy "$APK" "$REMOTE" --drive-use-trash=false --quiet

ID="$(rclone lsjson --stat "$REMOTE/$FILENAME" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).ID")"
[[ "$ID" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Could not read the Drive file id for $FILENAME." >&2; exit 1; }
# rclone link adds the reader permission for anyone with the link; print the usual file URL.
rclone link "$REMOTE/$FILENAME" >/dev/null
echo "https://drive.google.com/file/d/$ID/view"
