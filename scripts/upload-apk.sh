#!/usr/bin/env bash
# Upload an APK to Google Drive and print a link to it.
# Usage: upload-apk.sh <apk-path>
# Requires: rclone configured with a remote named "buddget-drive"
# One-time setup: brew install rclone && rclone config (name the remote "buddget-drive")
#
# The APK is a debug-signed, debuggable build, so the link is private by default (a Drive file URL that only opens for the
# signed-in owner). Set APK_PUBLIC_LINK=1 only to hand a build to someone else: it creates an "anyone with the link" share.
set -euo pipefail

APK="${1:?usage: upload-apk.sh <apk-path>}"
REMOTE="buddget-drive:Buddget/APKs"
FILENAME="$(basename "$APK")"

[ -f "$APK" ] || { echo "Not a file: $APK" >&2; exit 1; }
[[ "$FILENAME" =~ ^[A-Za-z0-9._-]+\.apk$ ]] || { echo "Unexpected APK file name: $FILENAME" >&2; exit 1; }

rclone copy "$APK" "$REMOTE" --drive-use-trash=false --quiet

if [ "${APK_PUBLIC_LINK:-0}" = 1 ]; then
  rclone link "$REMOTE/$FILENAME" --drive-link-type=view
else
  ID="$(rclone lsjson --stat "$REMOTE/$FILENAME" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).ID")"
  [[ "$ID" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Could not read the Drive file id for $FILENAME." >&2; exit 1; }
  echo "https://drive.google.com/file/d/$ID/view"
fi
