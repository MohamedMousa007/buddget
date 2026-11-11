#!/usr/bin/env bash
# One-time: push native-build secrets from this Mac to GitHub Actions secrets.
# Values are read locally and sent straight to `gh secret set`; nothing is printed.
# Usage: bash scripts/ci-secrets.sh /path/to/AuthKey_XXXX.p8 ASC_KEY_ID ASC_ISSUER_ID
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

P8="${1:?usage: ci-secrets.sh <AuthKey.p8> <ASC_KEY_ID> <ASC_ISSUER_ID>}"
KEY_ID="${2:?key id}"; ISSUER="${3:?issuer id}"
[ -f "$P8" ] || { echo "Not a file: $P8" >&2; exit 1; }
[[ "$KEY_ID" =~ ^[A-Z0-9]{10}$ ]] || { echo "ASC_KEY_ID must be 10 upper-case letters/digits." >&2; exit 1; }
[[ "$ISSUER" =~ ^[0-9a-fA-F-]{36}$ ]] || { echo "ASC_ISSUER_ID must be a UUID." >&2; exit 1; }
export GH_TOKEN="${GH_TOKEN:-$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p')}"
set_b64() { base64 < "$2" | tr -d '\n' | gh secret set "$1"; }

# Web/native env: only the keys baked into the native bundle (no Groq/Linear/dev bypass).
NATIVE_ENV="$(mktemp "${TMPDIR:-/tmp}/native-env.XXXXXX")"   # mode 600
trap 'rm -f "$NATIVE_ENV"' EXIT
grep -E '^NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY|API_BASE_URL|APP_URL|OAUTH_GOOGLE|OAUTH_APPLE|GOOGLE_IOS_CLIENT_ID|GOOGLE_WEB_CLIENT_ID)=' .env.local > "$NATIVE_ENV"
set_b64 NATIVE_ENV_LOCAL_B64 "$NATIVE_ENV"

set_b64 GOOGLE_SERVICE_INFO_PLIST_B64 ios/App/App/GoogleService-Info.plist
set_b64 GOOGLE_SERVICES_JSON_B64 android/app/google-services.json
set_b64 ASC_KEY_P8_B64 "$P8"
printf %s "$KEY_ID" | gh secret set ASC_KEY_ID
printf %s "$ISSUER" | gh secret set ASC_ISSUER_ID
set_b64 RCLONE_CONF_B64 "$HOME/.config/rclone/rclone.conf"

# Android signing: the app's ORIGINAL debug key. Its SHA-1 is registered with Google sign-in
# (Firebase / Cloud OAuth), so a different key breaks login. Standard debug password is "android".
set_b64 ANDROID_DEBUG_KEYSTORE_B64 "$HOME/.android/debug.keystore"
printf %s android | gh secret set ANDROID_DEBUG_KS_PASS
echo "secrets set:"; gh secret list
