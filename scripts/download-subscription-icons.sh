#!/usr/bin/env bash
# Download subscription catalog icons as PNGs (Google favicon service — stable 64–128px PNGs).
# Run from repo root: bash scripts/download-subscription-icons.sh
# For keys without a public favicon, the UI falls back to colored initials.

set -e

DEST="${1:-public/subscription-icons}"
mkdir -p "$DEST"

# favicon lookup domain per catalog `key` (must match subscriptionCatalog.ts keys)
while IFS='|' read -r key domain || [ -n "$key" ]; do
  [ -z "$key" ] && continue
  [[ "$key" =~ ^# ]] && continue
  out="$DEST/${key}.png"
  url="https://www.google.com/s2/favicons?sz=128&domain=${domain}"
  echo "Downloading $key ($domain)..."
  if curl -fsSL --connect-timeout 20 --max-time 45 "$url" -o "$out"; then
    if file "$out" 2>/dev/null | grep -qi 'PNG image'; then
      echo "  OK $out"
    else
      echo "  WARNING: not PNG — removing $key"
      rm -f "$out"
    fi
  else
    echo "  FAILED: $key"
    rm -f "$out"
  fi
done <<'EOF'
netflix|netflix.com
spotify|spotify.com
youtube_premium|youtube.com
shahid_vip|shahid.mbc.net
watchit|watchit.com
disney_plus|disneyplus.com
osn_plus|osnplus.com
apple_music|music.apple.com
apple_tv_plus|tv.apple.com
prime_video|primevideo.com
icloud|icloud.com
google_one|one.google.com
chatgpt_plus|openai.com
claude_pro|claude.ai
notion|notion.so
cursor|cursor.com
github_copilot|github.com
nordvpn|nordvpn.com
expressvpn|expressvpn.com
surfshark|surfshark.com
playstation_plus|store.playstation.com
xbox_gamepass|xbox.com
hbo_max|max.com
crunchyroll|crunchyroll.com
hulu|hulu.com
paramount_plus|paramountplus.com
peacock|peacocktv.com
mubi|mubi.com
starzplay|starzplay.com
anghami|anghami.com
tod|tod.tv
jawwy_tv|jawwy.com.sa
yango_play|yango.com
viu|viu.com
midjourney|midjourney.com
perplexity_pro|perplexity.ai
google_gemini|gemini.google.com
grammarly|grammarly.com
dropbox|dropbox.com
microsoft_365|microsoft.com
apple_fitness|fitness.apple.com
myfitnesspal|myfitnesspal.com
strava|strava.com
zoom_pro|zoom.us
slack_pro|slack.com
kindle_unlimited|amazon.com
audible|audible.com
scribd|scribd.com
nintendo_switch_online|nintendo.com
ea_play|ea.com
youtube_music|youtube.com
we_internet|te.eg
vodafone_eg|vodafone.com.eg
orange_eg|orange.eg
etisalat_eg|etisalat.eg
du_home|du.ae
du_mobile|du.ae
etisalat_uae|etisalat.ae
EOF

# Brands with no stable public favicon (TLS/bot blocks): regenerate tiles from catalog colors:
#   node scripts/generate-subscription-placeholder-icons.mjs
# (writes weyyak.png, gym.png)

echo "Done. Icons saved to $DEST/"
