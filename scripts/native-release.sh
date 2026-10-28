#!/usr/bin/env bash
# Build BOTH native apps on this Mac and ship them: iOS -> TestFlight, Android APK -> Google Drive.
# Always both platforms. Only run when the user says "build and upload apps".
# Usage: native-release.sh [label]
#
# Needs on this Mac: Xcode signed in to the Apple team, a JDK 21 (~/Library/Java), the Android SDK (~/Library/Android/sdk),
# rclone with the "buddget-drive" remote, a complete .env.local (see .env.example) and the two Firebase files
# (android/app/google-services.json, ios/App/App/GoogleService-Info.plist).
set -euo pipefail

LABEL="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TEAM=9PK34RL9DN
PBX=ios/App/App.xcodeproj/project.pbxproj
GRADLE=android/app/build.gradle
WORK="$(mktemp -d /tmp/buddget-release.XXXXXX)"

export JAVA_HOME="${JAVA_HOME:-$(ls -d "$HOME"/Library/Java/jdk-21*/Contents/Home 2>/dev/null | head -1)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[ -x "$JAVA_HOME/bin/java" ] || { echo "No JDK 21 found (looked in ~/Library/Java)." >&2; exit 1; }
[ -d "$ANDROID_HOME/platforms" ] || { echo "No Android SDK at $ANDROID_HOME." >&2; exit 1; }
[ -f .env.local ] || { echo ".env.local is missing." >&2; exit 1; }
# Native crash reporting starts before the web bundle, so the DSN is also baked into Info.plist / the Android manifest.
SENTRY_DSN="$(grep -E '^NEXT_PUBLIC_SENTRY_DSN=' .env.local | tail -1 | cut -d= -f2- | tr -d "\"'")"
[ -n "$SENTRY_DSN" ] || { echo "NEXT_PUBLIC_SENTRY_DSN is empty in .env.local: this build would ship without crash reporting." >&2; exit 1; }
export SENTRY_DSN

# The build must be what is on GitHub: nothing uncommitted, nothing unpushed.
if [ -n "$(git status --porcelain)" ]; then echo "Working tree is not clean. Commit or stash first." >&2; exit 1; fi
git fetch -q origin main
git merge-base --is-ancestor HEAD origin/main || { echo "origin/main does not contain HEAD ($(git rev-parse --short HEAD)). Push to dev and main first." >&2; exit 1; }

IOS_CUR=$(grep -m1 -oE "CURRENT_PROJECT_VERSION = [0-9]+;" "$PBX" | grep -oE "[0-9]+")
IOS_NEW=$((IOS_CUR + 1))
AND_CUR=$(grep -m1 -oE "versionCode [0-9]+" "$GRADLE" | grep -oE "[0-9]+")
AND_NEW=$((AND_CUR + 1))
# A failure after the bump would leave the tree dirty and the next run would refuse to start: put the two files back.
BUMPED=0
restore_bump() { [ "$BUMPED" = 1 ] && git checkout -q -- "$PBX" "$GRADLE" && echo "Version bump reverted." >&2; return 0; }
trap restore_bump EXIT
BUMPED=1
sed -i '' -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = ${IOS_NEW};/g" "$PBX"
sed -i '' -E "s/versionCode [0-9]+/versionCode ${AND_NEW}/" "$GRADLE"
echo "== iOS build $IOS_NEW, Android vc$AND_NEW"

echo "== Web bundle into both shells"
npm run cap:build

echo "== iOS archive"
(cd ios/App && xcodebuild -scheme App -configuration Release -destination "generic/platform=iOS" \
  -archivePath "$WORK/App.xcarchive" -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=$TEAM SENTRY_DSN="$SENTRY_DSN" archive) > "$WORK/ios-archive.log" 2>&1 || { tail -30 "$WORK/ios-archive.log"; echo "iOS archive failed (log: $WORK/ios-archive.log)" >&2; exit 1; }

echo "== iOS upload to TestFlight"
(cd ios/App && xcodebuild -exportArchive -archivePath "$WORK/App.xcarchive" -exportPath "$WORK/export" \
  -exportOptionsPlist ExportOptions.plist -allowProvisioningUpdates) > "$WORK/ios-export.log" 2>&1 || { tail -30 "$WORK/ios-export.log"; echo "iOS upload failed (log: $WORK/ios-export.log)" >&2; exit 1; }

echo "== Android APK"
(cd android && ./gradlew assembleDebug --no-daemon) > "$WORK/android.log" 2>&1 || { tail -40 "$WORK/android.log"; echo "Android build failed (log: $WORK/android.log)" >&2; exit 1; }
label=$(printf %s "${LABEL:-$(git log -1 --format=%s)}" | sed 's/[^a-zA-Z0-9]/-/g' | cut -c1-40 | sed 's/-*$//')
APK="$WORK/buddget-android-vc${AND_NEW}-${label}.apk"
cp android/app/build/outputs/apk/debug/app-debug.apk "$APK"

echo "== Android upload to Drive"
LINK="$(bash scripts/upload-apk.sh "$APK")"

echo "== Commit version bumps"
git add -f "$PBX" "$GRADLE"
BUMPED=0
git commit -q -m "chore(release): iOS ${IOS_NEW}, Android vc${AND_NEW} (local)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -q origin "HEAD:dev"
git push -q origin "HEAD:main"

echo
echo "iOS build ${IOS_NEW} uploaded to TestFlight (processing takes a few minutes in App Store Connect)."
echo "Android vc${AND_NEW}: ${LINK}"
