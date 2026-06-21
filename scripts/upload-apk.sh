#!/usr/bin/env bash
# Upload an APK to Google Drive and return an "anyone with link" share URL.
# Usage: upload-apk.sh <apk-path>
# Requires: rclone configured with a remote named "buddget-drive"
# One-time setup: brew install rclone && rclone config (name the remote "buddget-drive")
set -euo pipefail

APK="${1:?usage: upload-apk.sh <apk-path>}"
REMOTE="buddget-drive:Buddget/APKs"
FILENAME="$(basename "$APK")"

rclone copy "$APK" "$REMOTE" --drive-use-trash=false --quiet
# --drive-allow-import-name-change is not needed; link sets viewer for anyone
LINK=$(rclone link "$REMOTE/$FILENAME" --drive-link-type=view 2>/dev/null \
       || rclone link "$REMOTE/$FILENAME")   # fallback for older rclone

echo "$LINK"
