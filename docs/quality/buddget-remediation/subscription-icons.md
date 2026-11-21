# Subscription service logos

Every service in `src/lib/constants/subscriptionCatalog.ts` now shows its logo. The files are
`public/subscription-icons/<catalogue key>.webp`, one per key, all 512×512 lossy WebP, opaque and
full-bleed (app-icon style). `BrandTile` draws them in a 40, 48 or 56 pt tile with 5 to 7 px
padding and `object-contain`, so the largest drawn mark is 42 pt, 126 px at @3x. 512 px leaves
room to spare. `logoPolicy.test.ts` reads every file's WebP header and fails below 512 px or on a
non-square file.

How they were sourced (2026-11-21):

- First choice was the service's own app icon. The iTunes Search API gave the App Store listing,
  matched on bundle id and seller, and the 1024 px artwork. Google Play (512 px) was used where its
  icon was cleaner.
- Downloads went to a scratch folder and were checked with `file` before use. Nothing was executed.
- Nothing was upscaled. Each source was at least 512 px, and the downscale to 512 used Lanczos.
- Encoded with `cwebp -q 90 -m 6 -sharp_yuv`.
- The superseded low-res source PNGs in `assets/restricted-subscription-icons/` (the 7 replaced
  keys) were overwritten with the new 512 px tiles, so a re-export cannot bring the old ones back.
- Every tile was checked by eye on a contact sheet: right service, centred, no flag bands, no
  baked corners.
- Not checked: whether a regional app icon is the brand's newest mark everywhere.

## Replaced and added

| Key | Service | Change | Source | Size | Bytes | Note |
|---|---|---|---|---|---|---|
| `du_home` | du Home Internet | replaced | https://apps.apple.com/ae/app/du/id521545878 (1024 px icon) | 512×512 | 9684 | Same mark as du_mobile (du app). |
| `du_mobile` | du Mobile | replaced | https://apps.apple.com/ae/app/du/id521545878 (1024 px icon) | 512×512 | 9684 |  |
| `etisalat_uae` | e& (Etisalat UAE) | replaced | https://apps.apple.com/ae/app/etisalat-uae/id866147547 (1024 px icon) | 512×512 | 11418 | The consumer app's current icon. The UAE telecom unit trades as "etisalat by e&", so it shows the etisalat wordmark, not the group's e& mark the old 48 px file had. |
| `gym` | Gym Membership | replaced | lucide-react `Dumbbell` (ISC) | 512×512 | 8510 | Generic category, not a brand: lucide `Dumbbell` (the app's fitness glyph) in white on the catalogue colour #8B5CF6, rendered from SVG at 1024 px. |
| `hulu` | Hulu | replaced | https://apps.apple.com/us/app/hulu-stream-tv-shows-movies/id376510438 (1024 px icon) | 512×512 | 4802 |  |
| `paramount_plus` | Paramount+ | replaced | https://apps.apple.com/us/app/paramount/id530168168 (1024 px icon) | 512×512 | 16060 |  |
| `peacock` | Peacock | replaced | https://apps.apple.com/us/app/peacock-tv-stream-tv-movies/id1508186374 (1024 px icon) | 512×512 | 7458 |  |
| `anytime_fitness` | Anytime Fitness | added | https://apps.apple.com/us/app/af-app/id1598355340 (1024 px icon) | 512×512 | 6176 |  |
| `classpass` | ClassPass | added | https://play.google.com/store/apps/details?id=com.classpass.classpass (512 px) | 512×512 | 8924 | Play icon is full-bleed; the App Store icon has a baked rounded border. |
| `deliveroo_plus` | Deliveroo Plus | added | https://play.google.com/store/apps/details?id=com.deliveroo.orderapp (512 px) | 512×512 | 6688 | Play icon is full-bleed; the App Store icon has baked rounded corners. |
| `fitness_first` | Fitness First | added | https://apps.apple.com/ae/app/fitness-first-mena/id1562555334 (1024 px icon) | 512×512 | 5868 | Official Fitness First MENA app (built by Scope Software for the franchise). |
| `fitness_time` | Fitness Time | added | https://apps.apple.com/sa/app/fitness-time-%D9%88%D9%82%D8%AA-%D8%A7%D9%84%D9%84%D9%8A%D8%A7%D9%82%D8%A9/id6496972792 (1024 px icon) | 512×512 | 2294 |  |
| `golds_gym` | Gold's Gym | added | https://apps.apple.com/us/app/golds-gym/id6755833852 (1024 px icon) | 512×512 | 25122 | Policy was `initials` (research: YELLOW USE_INITIALS); flipped to `logo` on the owner's 2026-11-21 request. Revert by deleting the WebP and setting it back. |
| `gymnation` | Gymnation | added | https://apps.apple.com/ae/app/gymnation/id6759922886 (1024 px icon) | 512×512 | 4876 |  |
| `hungerstation` | HungerStation | added | https://apps.apple.com/sa/app/hungerstation-food-delivery/id596011949 (1024 px icon) | 512×512 | 4592 |  |
| `jahez` | Jahez | added | https://apps.apple.com/sa/app/jahez-%D8%AC%D8%A7%D9%87%D8%B2/id1137352156 (1024 px icon) | 512×512 | 6318 |  |
| `lebara_ksa` | Lebara KSA | added | https://apps.apple.com/sa/app/lebara-ksa/id1269029448 (1024 px icon) | 512×512 | 11520 | Baked white rounded corners filled with the icon's own background blue. |
| `mobily` | Mobily | added | https://commons.wikimedia.org/wiki/File:Mobily_Logo.svg (glyph) + colours from https://apps.apple.com/sa/app/mobily-%D9%85%D9%88%D8%A8%D8%A7%D9%8A%D9%84%D9%8A/id375539359 | 512×512 | 3818 | The current app icon carries a Saudi National Day flag band. Tile rebuilt from the official vector glyph (Commons `Mobily Logo.svg`, rendered at 1280 px) in the app icon's colours: cyan glyph on its blue. |
| `mobily_home` | Mobily Home Fiber | added | https://commons.wikimedia.org/wiki/File:Mobily_Logo.svg (glyph) + colours from https://apps.apple.com/sa/app/mobily-%D9%85%D9%88%D8%A8%D8%A7%D9%8A%D9%84%D9%8A/id375539359 | 512×512 | 3818 | Same tile as mobily. |
| `salam_ksa` | Salam Mobile | added | https://play.google.com/store/apps/details?id=com.salam.app.android (512 px) | 512×512 | 9082 | Transparent rounded corners filled with the icon's own background green. |
| `stc` | stc | added | https://apps.apple.com/sa/app/mystc-ksa/id808807355 (1024 px icon) | 512×512 | 6276 | The current app icon carries a Saudi National Day flag band. Kept the purple band with the stc wordmark and extended it with the same flat purple to a square. |
| `stc_home` | stc Baity | added | https://apps.apple.com/sa/app/mystc-ksa/id808807355 (1024 px icon) | 512×512 | 6276 | Same tile as stc. |
| `stc_tv` | stc tv | added | https://apps.apple.com/sa/app/stc-tv/id1315586892 (1024 px icon) | 512×512 | 7926 |  |
| `virgin_ksa` | Virgin Mobile KSA | added | https://apps.apple.com/sa/app/virgin-mobile-ksa/id1439413116 (1024 px icon) | 512×512 | 15220 |  |
| `virgin_uae` | Virgin Mobile UAE | added | https://apps.apple.com/ae/app/virgin-mobile-uae/id1198503948 (1024 px icon) | 512×512 | 11406 |  |
| `zain_home` | Zain Home | added | https://play.google.com/store/apps/details?id=com.zainsa.b2c (512 px) | 512×512 | 10368 | Same tile as zain_ksa. |
| `zain_ksa` | Zain KSA | added | https://play.google.com/store/apps/details?id=com.zainsa.b2c (512 px) | 512×512 | 10368 | Play icon, without the National Day flag band the App Store icon has. |

## Pre-existing, unchanged (108)

Each is 512×512. Where a source PNG exists in `assets/restricted-subscription-icons/`, it is at
least 512 px, so those were not upscaled. Keys with no PNG there were not checked this way.
All 115 files were viewed on a thumbnail contact sheet, and about 35 at a 1:1 centre crop: the
flattest and the most detailed ones. No heavy compression artefacts or tiny marks were found, so
none was re-exported. Source URLs were not recorded when they were added.

`adobe_creative_cloud`, `anghami`, `apple_arcade`, `apple_fitness`, `apple_music`, `apple_tv_plus`, `audible`, `aws`, `bein_sports`, `bitwarden`, `breadfast`, `bumble`, `calm`, `canva`, `careem_plus`, `carrefour_mylo`, `chatgpt_plus`, `chefaa`, `claude_pro`, `cloudflare`, `coursera`, `crunchyroll`, `cursor`, `deezer`, `digitalocean`, `discord_nitro`, `disney_plus`, `dropbox`, `duolingo`, `ea_play`, `economist`, `elmenus`, `etisalat_eg`, `evernote`, `expressvpn`, `figma`, `fortnite_crew`, `github_copilot`, `godaddy`, `google_gemini`, `google_one`, `google_play_pass`, `grammarly`, `hbo_max`, `headspace`, `icloud`, `indrive`, `instashop`, `jawwy_tv`, `kindle_unlimited`, `linkedin_premium`, `masterclass`, `medium`, `microsoft_365`, `midjourney`, `mrsool`, `mubi`, `myfitnesspal`, `namecheap`, `netflix`, `nintendo_switch_online`, `noon_one`, `nordvpn`, `notion`, `nytimes`, `onepassword`, `orange_eg`, `osn_plus`, `patreon`, `perplexity_pro`, `playstation_plus`, `prime_video`, `proton`, `rabbit`, `roblox_premium`, `scribd`, `shahid_vip`, `skillshare`, `slack_pro`, `snapchat_plus`, `spotify`, `starlink`, `starzplay`, `storytel`, `strava`, `substack`, `surfshark`, `swvl`, `talabat_pro`, `telegram_premium`, `tinder`, `tod`, `twitch`, `uber_one`, `ubisoft_plus`, `udemy`, `vezeeta`, `viu`, `vodafone_eg`, `watchit`, `we_internet`, `weyyak`, `x_premium`, `xbox_gamepass`, `yango_play`, `youtube_music`, `youtube_premium`, `zoom_pro`

## In the logo policy but not in the catalogue (18)

These files ship and are allowed by `LOGO_POLICY`, but no catalogue entry uses the key. They show
only on a subscription saved with that `brandKey`. They were left alone.

`aws`, `breadfast`, `carrefour_mylo`, `chefaa`, `cloudflare`, `digitalocean`, `elmenus`, `godaddy`, `google_play_pass`, `indrive`, `instashop`, `mrsool`, `namecheap`, `rabbit`, `roblox_premium`, `swvl`, `udemy`, `vezeeta`
