#!/usr/bin/env bash
# Bump build numbers, build the web bundle into both native shells,
# upload iOS to TestFlight, and produce an Android APK.
# Emits a final "RELEASE_DONE ..." line the Linear bot parses.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TEAM_ID="9PK34RL9DN"
PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"
GRADLE="android/app/build.gradle"

# --- bump iOS build number (both occurrences in pbxproj) ---
CUR_IOS=$(grep -m1 -oE "CURRENT_PROJECT_VERSION = [0-9]+;" "$PBXPROJ" | grep -oE "[0-9]+")
NEW_IOS=$((CUR_IOS + 1))
sed -i '' -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = ${NEW_IOS};/g" "$PBXPROJ"

# --- bump Android versionCode ---
CUR_AND=$(grep -m1 -oE "versionCode [0-9]+" "$GRADLE" | grep -oE "[0-9]+")
NEW_AND=$((CUR_AND + 1))
sed -i '' -E "s/versionCode [0-9]+/versionCode ${NEW_AND}/" "$GRADLE"

echo ">> iOS build ${CUR_IOS} -> ${NEW_IOS} | Android versionCode ${CUR_AND} -> ${NEW_AND}"

# --- build web bundle into native shells (once, never bare cap sync) ---
npm run cap:build

# --- iOS: archive + upload to TestFlight ---
ARCHIVE="/tmp/buddget-${NEW_IOS}.xcarchive"
EXPORT_DIR="/tmp/buddget-${NEW_IOS}-export"
rm -rf "$ARCHIVE" "$EXPORT_DIR"
( cd ios/App && xcodebuild -scheme App -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "$ARCHIVE" -allowProvisioningUpdates \
    CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM_ID" archive )
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist ios/App/ExportOptions.plist \
  -allowProvisioningUpdates

# --- Android: debug APK (no release signing config in this repo) ---
# launchd does not inherit the login shell; use Android Studio's bundled JRE.
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
( cd android && ./gradlew assembleDebug )
mkdir -p dist
# Name includes ticket ID when provided, otherwise a short slug from the last commit.
TICKET="${1:-}"
if [ -n "$TICKET" ]; then
  APK_LABEL="$TICKET"
else
  APK_LABEL=$(git log -1 --format="%s" | sed 's/[^a-zA-Z0-9]/-/g' | cut -c1-40 | sed 's/-*$//')
fi
DEST="dist/buddget-android-vc${NEW_AND}-${APK_LABEL}.apk"
cp android/app/build/outputs/apk/debug/app-debug.apk "$DEST"

# --- Upload APK to Google Drive (anyone with link) ---
DRIVE_LINK=""
if command -v rclone >/dev/null 2>&1; then
  DRIVE_LINK=$(bash scripts/upload-apk.sh "$DEST" 2>/dev/null || echo "")
  [ -n "$DRIVE_LINK" ] && echo ">> APK uploaded: $DRIVE_LINK" || echo ">> Drive upload failed — APK at $DEST"
else
  echo ">> rclone not installed — skipping Drive upload"
fi

echo "RELEASE_DONE ios_build=${NEW_IOS} android_versionCode=${NEW_AND} apk=${DEST} drive_link=${DRIVE_LINK}"
