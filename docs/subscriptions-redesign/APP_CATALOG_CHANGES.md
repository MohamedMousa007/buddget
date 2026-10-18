# App catalog changes (2026-10-18), Egypt / Saudi Arabia / UAE research applied

Sources: `catalog.json` + `CHANGES.md` (Egypt, browser-verified 2026-10-17), `gcc/catalog_sa.json`, `gcc/catalog_ae.json` + `CHANGES_GCC.md`. Rules applied: a plan price is written only when research confidence is high or medium AND `checked_at` is set (then `verifiedAt = 2026-10-17`); low/unverified rows are never prefilled; existing plans are kept only when the research did not contradict them. All catalog edits are in `src/lib/constants/subscriptionCatalog.ts`; generated, then covered by `subscriptionCatalog.test.ts`.

## Counts

- Brands: 63 -> 117 (54 added)
- Plans updated (price/name/currency/cycle changed): 51
- Plans added: 260 (of which 92 on new brands)
- Plans removed: 83
- Plans re-verified unchanged (verifiedAt bumped to 2026-10-17): 63
- Brand/region pairs that HAD plans and are now left unpriced: 42
- New brand/region pairs available but unpriced: 95 new-brand + 8 new-region on existing brands

## Updated plans (before -> after)

| Brand | Region | Plan id | Before | After | Source [confidence] |
|---|---|---|---|---|---|
| anghami | egypt | `anghami_plus` | 60 (region) monthly | 69.99 (region) monthly | https://support.anghami.com/hc/en-us/articles/5428211075482-Anghami-Plus-Pricing-in-Egypt [medium] |
| anghami | uae | `anghami_plus` | 15 (region) monthly | 22.99 (region) monthly | https://apps.apple.com/ae/app/id545395155 [medium] |
| apple_music | egypt | `apple_music_individual` | 69.99 (region) monthly | 79.99 (region) monthly | https://music.apple.com/eg/subscribe [high] |
| apple_music | saudi | `apple_music_family` | 33.99 (region) monthly | 39.99 (region) monthly | https://www.apple.com/sa/apple-music/ [high] |
| apple_music | saudi | `apple_music_individual` | 21.99 (region) monthly | 23.99 (region) monthly | https://www.apple.com/sa/apple-music/ [high] |
| apple_music | uae | `apple_music_family` | 33.99 (region) monthly | 39.99 (region) monthly | https://www.apple.com/ae/apple-music/ [high] |
| apple_music | uae | `apple_music_individual` | 21.99 (region) monthly | 23.99 (region) monthly | https://www.apple.com/ae/apple-music/ [high] |
| apple_music | uae | `apple_music_student` | 11.99 (region) monthly | 12.99 (region) monthly | https://www.apple.com/ae/apple-music/ [high] |
| chatgpt_plus | egypt | `chatgpt_plus_plus` | 20 USD monthly | 999.99 (region) monthly | https://chatgpt.com/pricing [high] |
| crunchyroll | uae | `crunchyroll_fan` | 25 (region) monthly | 21.99 (region) monthly | https://apps.apple.com/ae/app/id329913454 [medium] |
| crunchyroll | uae | `crunchyroll_mega_fan` | 35 (region) monthly | 25.99 (region) monthly | https://apps.apple.com/ae/app/id329913454 [medium] |
| disney_plus | egypt | `disney_plus_monthly` | 170 (region) monthly | 79.99 (region) monthly | https://geopriced.com/price/disney-plus/egypt [medium] |
| google_gemini | egypt | `google_gemini_google_ai_pro` | 300 (region) monthly | 939.99 (region) monthly | https://one.google.com/about/plans?hl=en&gl=EG [high] |
| google_gemini | uae | `google_gemini_google_ai_pro` | 75 (region) monthly | 76.99 (region) monthly | https://tbreak.com/google-ai-plans-uae-youtube-premium [medium] |
| google_one | egypt | `google_one_100_gb` | 30 (region) monthly | 94.99 (region) monthly | https://one.google.com/about/plans?hl=en&gl=EG [high] |
| icloud | egypt | `icloud_12tb` | 2999.99 (region) monthly | 3599.99 (region) monthly | https://support.apple.com/en-eg/108047 [high] |
| icloud | egypt | `icloud_200gb` | 149.99 (region) monthly | 179.99 (region) monthly | https://support.apple.com/en-eg/108047 [high] |
| icloud | egypt | `icloud_2tb` | 499.99 (region) monthly | 599.99 (region) monthly | https://support.apple.com/en-eg/108047 [high] |
| icloud | egypt | `icloud_50gb` | 39.99 (region) monthly | 49.99 (region) monthly | https://support.apple.com/en-eg/108047 [high] |
| icloud | egypt | `icloud_6tb` | 1499.99 (region) monthly | 1799.99 (region) monthly | https://support.apple.com/en-eg/108047 [high] |
| microsoft_365 | egypt | `microsoft_365_family` | 220 (region) monthly | 289 (region) monthly | https://www.microsoft.com/en-eg/microsoft-365/p/microsoft-365-personal/cfq7ttc0k5dm [high] |
| microsoft_365 | egypt | `microsoft_365_personal` | 140 (region) monthly | 239 (region) monthly | https://www.microsoft.com/en-eg/microsoft-365/p/microsoft-365-personal/cfq7ttc0k5bf [high] |
| perplexity_pro | uae | `perplexity_pro_pro` | 80 (region) monthly | 79.99 (region) monthly | https://apps.apple.com/ae/app/perplexity-ask-anything/id1668000334 [high] |
| playstation_plus | saudi | `playstation_plus_deluxe` | 15.99 USD monthly | 59.99 (region) monthly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | saudi | `playstation_plus_deluxe_quarterly` | 43.99 USD quarterly | 164.99 (region) quarterly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | saudi | `playstation_plus_deluxe_yearly` | 124.99 USD yearly | 469.99 (region) yearly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | saudi | `playstation_plus_essential` | 8.99 USD monthly | 33.99 (region) monthly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | saudi | `playstation_plus_essential_quarterly` | 22.99 USD quarterly | 85.99 (region) quarterly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | saudi | `playstation_plus_essential_yearly` | 64.99 USD yearly | 243.99 (region) yearly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | saudi | `playstation_plus_extra` | 13.49 USD monthly | 49.99 (region) monthly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | saudi | `playstation_plus_extra_quarterly` | 37.99 USD quarterly | 141.99 (region) quarterly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | saudi | `playstation_plus_extra_yearly` | 107.99 USD yearly | 399.99 (region) yearly | https://www.playstation.com/en-sa/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_deluxe` | 15.99 USD monthly | 58.99 (region) monthly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_deluxe_quarterly` | 43.99 USD quarterly | 161.99 (region) quarterly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_deluxe_yearly` | 124.99 USD yearly | 459.99 (region) yearly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_essential` | 8.99 USD monthly | 32.99 (region) monthly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_essential_quarterly` | 22.99 USD quarterly | 84.99 (region) quarterly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_essential_yearly` | 64.99 USD yearly | 239.99 (region) yearly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_extra` | 13.49 USD monthly | 49.99 (region) monthly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_extra_quarterly` | 37.99 USD quarterly | 139.99 (region) quarterly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| playstation_plus | uae | `playstation_plus_extra_yearly` | 107.99 USD yearly | 396.99 (region) yearly | https://www.playstation.com/en-ae/ps-plus/ [high] |
| stc | saudi | `stc_mofawtar_2` | 138 (region) monthly ("Mofawtar 2") | 145 (region) monthly ("Mofawtar 2 Lite") | https://www.stc.com.sa/en/personal/mobile/packages/postpaid.html [high] |
| stc | saudi | `stc_mofawtar_2_plus` | 172.5 (region) monthly ("Mofawtar 2 Plus") | 180 (region) monthly ("Mofawtar 2 Extra") | https://www.stc.com.sa/en/personal/mobile/packages/postpaid.html [high] |
| stc | saudi | `stc_mofawtar_4` | 517.5 (region) monthly ("Mofawtar 4") | 460 (region) monthly ("Mofawtar 4 Extra") | https://www.stc.com.sa/en/personal/mobile/packages/postpaid.html [high] |
| strava | uae | `strava_summit` | 40 (region) monthly | 29.99 (region) monthly | https://apps.apple.com/ae/app/strava-run-bike-hike/id426826309 [high] |
| viu | uae | `viu_premium` | 20 (region) monthly | 29.99 (region) monthly | https://apps.apple.com/ae/app/id1044543328 [medium] |
| weyyak | uae | `weyyak_monthly` | 25 (region) monthly | 18.99 (region) monthly | https://apps.apple.com/ae/app/id1226514781 [medium] |
| youtube_premium | egypt | `youtube_premium_family` | 100 (region) monthly | 159.99 (region) monthly | https://www.youtube.com/premium [high] |
| youtube_premium | egypt | `youtube_premium_individual` | 66 (region) monthly | 87.99 (region) monthly | https://www.youtube.com/premium [high] |
| youtube_premium | uae | `youtube_premium_family` | 35 (region) monthly | 57.99 (region) monthly | https://apps.apple.com/ae/app/id544007664 [medium] |
| youtube_premium | uae | `youtube_premium_individual` | 23 (region) monthly | 29.99 (region) monthly | https://spendfigo.com/guides/youtube-premium/uae [medium] |

## Removed plans

| Brand | Region | Plan id | Was | Why |
|---|---|---|---|---|
| anghami | egypt | `anghami_platinum` | 100 (region) monthly | Platinum not in research; Plus priced per channel |
| anghami | uae | `anghami_platinum` | 25 (region) monthly | Platinum not in research; Plus priced per channel |
| apple_fitness | egypt | `apple_fitness_monthly` | 100 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| apple_fitness | uae | `apple_fitness_monthly` | 35 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| apple_tv_plus | egypt | `apple_tv_plus_apple_tv` | 119.99 (region) monthly | Apple lists no standalone price ("available with iCloud+") |
| apple_tv_plus | saudi | `apple_tv_plus_apple_tv` | 29.99 (region) monthly | Apple lists no standalone price ("available with iCloud+") |
| apple_tv_plus | uae | `apple_tv_plus_apple_tv` | 27.99 (region) monthly | Apple lists no standalone price ("available with iCloud+") |
| audible | egypt | `audible_plus` | 180 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| audible | uae | `audible_plus` | 45 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| crunchyroll | egypt | `crunchyroll_fan` | 100 (region) monthly | research (low) USD 7.99+ vs app 100/140 EGP: contradicted |
| crunchyroll | egypt | `crunchyroll_mega_fan` | 140 (region) monthly | research (low) USD 7.99+ vs app 100/140 EGP: contradicted |
| cursor | egypt | `cursor_business` | 480 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| cursor | egypt | `cursor_pro` | 320 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| cursor | uae | `cursor_business` | 120 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| cursor | uae | `cursor_pro` | 80 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| disney_plus | egypt | `disney_plus_yearly` | 1700 (region) yearly | Egypt shows a single tier; no yearly plan on the page |
| dropbox | egypt | `dropbox_plus` | 180 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| dropbox | egypt | `dropbox_professional` | 480 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| dropbox | uae | `dropbox_plus` | 45 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| dropbox | uae | `dropbox_professional` | 120 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| du_home | uae | `du_home_plus` | 449 (region) monthly | du.ae unreadable; research (low) shows 389-749, not 299/449: left unpriced |
| du_home | uae | `du_home_starter` | 299 (region) monthly | du.ae unreadable; research (low) shows 389-749, not 299/449: left unpriced |
| du_mobile | uae | `du_mobile_postpaid_200` | 200 (region) monthly | research (low) lists Power Plan 125/150/225; 200 does not exist |
| ea_play | saudi | `ea_play_monthly` | 24 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| ea_play | uae | `ea_play_monthly` | 5.99 USD monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| etisalat_eg | egypt | `etisalat_eg_super_100` | 100 (region) monthly | plan set replaced by Emerald/Hekaya/eHome (high) |
| etisalat_eg | egypt | `etisalat_eg_super_200` | 200 (region) monthly | plan set replaced by Emerald/Hekaya/eHome (high) |
| etisalat_uae | uae | `etisalat_uae_elife_basic` | 319 (region) monthly | names and prices no longer exist; eLife Lite/Unlimited/Ultra Fusion/Family replace them |
| etisalat_uae | uae | `etisalat_uae_elife_plus` | 449 (region) monthly | names and prices no longer exist; eLife Lite/Unlimited/Ultra Fusion/Family replace them |
| expressvpn | egypt | `expressvpn_monthly` | 200 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| expressvpn | uae | `expressvpn_monthly` | 50 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| google_one | egypt | `google_one_2_tb` | 150 (region) monthly | 2 TB tier is now Google AI Pro / Plus; old number contradicted |
| google_one | uae | `google_one_100_gb` | 7 (region) monthly | 2 TB tier is now Google AI Pro / Plus; old number contradicted |
| google_one | uae | `google_one_2_tb` | 37 (region) monthly | 2 TB tier is now Google AI Pro / Plus; old number contradicted |
| grammarly | egypt | `grammarly_premium` | 180 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| grammarly | uae | `grammarly_premium` | 45 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| kindle_unlimited | egypt | `kindle_unlimited_monthly` | 140 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| midjourney | egypt | `midjourney_basic` | 160 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| midjourney | egypt | `midjourney_standard` | 320 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| midjourney | uae | `midjourney_basic` | 40 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| midjourney | uae | `midjourney_standard` | 80 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| mubi | egypt | `mubi_monthly` | 160 (region) monthly | research: USD billed, no local price |
| mubi | uae | `mubi_monthly` | 40 (region) monthly | research: USD billed, no local price |
| myfitnesspal | egypt | `myfitnesspal_premium` | 160 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| myfitnesspal | uae | `myfitnesspal_premium` | 40 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| nordvpn | egypt | `nordvpn_monthly` | 190 (region) monthly | monthly number was a hand conversion; research is USD billed |
| nordvpn | uae | `nordvpn_monthly` | 46 (region) monthly | monthly number was a hand conversion; research is USD billed |
| orange_eg | egypt | `orange_eg_air_100` | 100 (region) monthly | plan set replaced by PREMIER/FREEmax/DSL (high) |
| orange_eg | egypt | `orange_eg_air_200` | 200 (region) monthly | plan set replaced by PREMIER/FREEmax/DSL (high) |
| osn_plus | egypt | `osn_plus_annual` | 1200 (region) yearly | replaced by the tier structure OSN+ now sells (web USD, carrier EGP, store AED/SAR) |
| osn_plus | egypt | `osn_plus_monthly` | 120 (region) monthly | replaced by the tier structure OSN+ now sells (web USD, carrier EGP, store AED/SAR) |
| osn_plus | uae | `osn_plus_annual` | 300 (region) yearly | replaced by the tier structure OSN+ now sells (web USD, carrier EGP, store AED/SAR) |
| osn_plus | uae | `osn_plus_monthly` | 30 (region) monthly | replaced by the tier structure OSN+ now sells (web USD, carrier EGP, store AED/SAR) |
| perplexity_pro | egypt | `perplexity_pro_pro` | 320 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| scribd | egypt | `scribd_monthly` | 160 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| starzplay | egypt | `starzplay_monthly` | 160 (region) monthly | research: 34.99-49.99 AED depending on SKU; replaced by Max/Sports |
| starzplay | uae | `starzplay_monthly` | 40 (region) monthly | research: 34.99-49.99 AED depending on SKU; replaced by Max/Sports |
| strava | egypt | `strava_summit` | 160 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| surfshark | egypt | `surfshark_monthly` | 140 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| surfshark | uae | `surfshark_monthly` | 35 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| tod | uae | `tod_entertainment` | 35 (region) monthly | research (low) App Store 39.99/69.99/109.99 AED vs app 35/55 |
| tod | uae | `tod_sports` | 55 (region) monthly | research (low) App Store 39.99/69.99/109.99 AED vs app 35/55 |
| viu | egypt | `viu_premium` | 80 (region) monthly | research (low) 20 EGP vs app 80 EGP: contradicted, left unpriced in Egypt |
| vodafone_eg | egypt | `vodafone_eg_flex_100` | 100 (region) monthly | plan set replaced by Flex/RED/Home Wireless (high) |
| vodafone_eg | egypt | `vodafone_eg_flex_200` | 200 (region) monthly | plan set replaced by Flex/RED/Home Wireless (high) |
| vodafone_eg | egypt | `vodafone_eg_flex_350` | 350 (region) monthly | plan set replaced by Flex/RED/Home Wireless (high) |
| we_internet | egypt | `we_internet_140_gb` | 250 (region) monthly | plan set replaced by Space Super / Gold (high) |
| we_internet | egypt | `we_internet_250_gb` | 400 (region) monthly | plan set replaced by Space Super / Gold (high) |
| we_internet | egypt | `we_internet_500_gb` | 600 (region) monthly | plan set replaced by Space Super / Gold (high) |
| weyyak | egypt | `weyyak_monthly` | 100 (region) monthly | research (low) 25 EGP vs app 100 EGP: contradicted |
| xbox_gamepass | saudi | `xbox_gamepass_essential` | 29.99 (region) monthly | USD list stale (Oct 2025 hike), no official AED/SAR price: left unpriced |
| xbox_gamepass | saudi | `xbox_gamepass_premium` | 39.99 (region) monthly | USD list stale (Oct 2025 hike), no official AED/SAR price: left unpriced |
| xbox_gamepass | saudi | `xbox_gamepass_ultimate` | 60.99 (region) monthly | USD list stale (Oct 2025 hike), no official AED/SAR price: left unpriced |
| xbox_gamepass | uae | `xbox_gamepass_essential` | 7.99 USD monthly | USD list stale (Oct 2025 hike), no official AED/SAR price: left unpriced |
| xbox_gamepass | uae | `xbox_gamepass_premium` | 10.99 USD monthly | USD list stale (Oct 2025 hike), no official AED/SAR price: left unpriced |
| xbox_gamepass | uae | `xbox_gamepass_ultimate` | 15.99 USD monthly | USD list stale (Oct 2025 hike), no official AED/SAR price: left unpriced |
| yango_play | egypt | `yango_play_monthly` | 100 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| youtube_music | egypt | `youtube_music_family` | 100 (region) monthly | research: iOS 31.99/47.99 AED (low); Egypt number shares the stale basis of YouTube Premium EG 66 |
| youtube_music | egypt | `youtube_music_individual` | 66 (region) monthly | research: iOS 31.99/47.99 AED (low); Egypt number shares the stale basis of YouTube Premium EG 66 |
| youtube_music | uae | `youtube_music_family` | 35 (region) monthly | research: iOS 31.99/47.99 AED (low); Egypt number shares the stale basis of YouTube Premium EG 66 |
| youtube_music | uae | `youtube_music_individual` | 23 (region) monthly | research: iOS 31.99/47.99 AED (low); Egypt number shares the stale basis of YouTube Premium EG 66 |
| zoom_pro | egypt | `zoom_pro_pro` | 220 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |
| zoom_pro | uae | `zoom_pro_pro` | 55 (region) monthly | research (low confidence or USD billing) contradicts the stored hand-converted number; not prefilled |

## Added plans

| Brand | Region | Plans (amount, confidence) | Source |
|---|---|---|---|
| shahid_vip | saudi | Ultimate 89.99 [medium]; VIP 44.99 [medium]; VIP BigTime 54.99 [medium]; VIP Sports 69.99 [medium]; VIP (yearly) 449.99 [medium] | apps.apple.com |
| shahid_vip | uae | Ultimate 89.99 [medium]; VIP 44.99 [medium]; VIP BigTime 54.99 [medium]; VIP Sports 69.99 [medium]; VIP (yearly) 449.99 [medium] | apps.apple.com |
| watchit | egypt | Basic 19.99 [high]; Basic (carrier billing) 110 [high]; Basic (carrier billing, yearly) 1320 [high]; Basic (yearly) 199.99 [high]; Premium 99.99 [high]; Premium (carrier billing) 140 [high]; Premium (carrier billing, yearly) 1680 [high]; Premium (yearly) 999.99 [high] | www.watchit.com |
| osn_plus | egypt | Premium (web) 4.99 USD [high]; Premium (web, yearly) 49.92 USD [high]; Standard with ads (carrier billing) 90 [high]; Standard with ads (web) 1.99 USD [high]; Standard (carrier billing) 140 [high]; Standard (web) 3.49 USD [high]; Standard (web, yearly) 34.92 USD [high] | osnplus.com |
| osn_plus | saudi | Mobile 34.99 [medium]; Premium 69.99 [high]; Premium (yearly) 699.99 [medium]; Standard 48.99 [high]; Standard with ads 34.99 [medium]; Standard (yearly) 489.99 [medium] | apps.apple.com, mobily.com.sa |
| osn_plus | uae | Mobile 29.99 [medium]; Premium 64.99 [medium]; Premium (yearly) 649.99 [medium]; Standard 48.99 [medium]; Standard with ads 29.99 [medium]; Standard (yearly) 489.99 [medium] | apps.apple.com |
| youtube_premium | egypt | Premium Lite 52.99 [high]; Student 52.99 [high] | www.youtube.com |
| google_one | egypt | Google AI Plus 449.99 [high]; Google AI Pro 939.99 [high] | one.google.com |
| google_one | uae | Google AI Plus 18.99 [medium]; Google AI Pro 76.99 [medium]; Google AI Ultra 369.99 [medium] | tbreak.com |
| chatgpt_plus | egypt | Go 220 [high]; Pro 5400 [high] | chatgpt.com |
| chatgpt_plus | saudi | Go 35 [high]; Plus (App Store) 89.99 [high] | apps.apple.com |
| chatgpt_plus | uae | Go 29.99 [high]; Plus (App Store) 79.99 [high] | apps.apple.com |
| claude_pro | egypt | Max (from) 100 USD [high] | claude.com |
| claude_pro | saudi | Max (from) 100 USD [high]; Max 20x (App Store) 999.99 [high]; Max 5x (App Store) 499.99 [high]; Pro (App Store) 89.99 [high]; Pro (App Store, yearly) 999.99 [high] | apps.apple.com, claude.com |
| claude_pro | uae | Max (from) 100 USD [high]; Max 20x (App Store) 999.99 [high]; Max 5x (App Store) 499.99 [high]; Pro (App Store) 79.99 [high]; Pro (App Store, yearly) 799.99 [high] | apps.apple.com, claude.com |
| nordvpn | egypt | Basic (27 months) 3.49 USD [high]; Complete (27 months) 4.49 USD [high]; Complete Max (27 months) 6.49 USD [high] | nordvpn.com |
| nordvpn | saudi | Basic (27 months) 3.49 USD [high]; Complete (27 months) 4.49 USD [high]; Complete Max (27 months) 6.49 USD [high] | nordvpn.com |
| nordvpn | uae | Basic (27 months) 3.49 USD [high]; Complete (27 months) 4.49 USD [high]; Complete Max (27 months) 6.49 USD [high] | nordvpn.com |
| we_internet | egypt | Gold 1200 (65 GB, 8000 min) 1200 [high]; Gold 1500 (70 GB, 9000 min) 1500 [high]; Gold 2300 (130 GB, 10000 min) 2300 [high]; Gold 300 (5.5 GB, 1200 min) 300 [high]; Gold 600 (20 GB, 3700 min) 600 [high]; Gold 890 (30 GB, 6000 min) 890 [high]; Space Super 30 Mbps, 150 GB 260 [high]; Space Super 30 Mbps, 1500 GB 1650 [high]; Space Super 30 Mbps, 200 GB 330 [high]; Space Super 30 Mbps, 250 GB 395 [high]; Space Super 30 Mbps, 300 GB 460 [high]; Space Super 30 Mbps, 400 GB 580 [high]; Space Super 30 Mbps, 50 GB 150 [high]; Space Super 30 Mbps, 500 GB 660 [high]; Space Super 30 Mbps, 750 GB 925 [high] | www.te.eg |
| vodafone_eg | egypt | Flex 115 115 [high]; Flex 175 175 [high]; Flex 345 345 [high]; Flex 52 52 [high]; Flex 80 80 [high]; Home Wireless 135 GB 520 [high]; Home Wireless 250 GB 830 [high]; Home Wireless 40 GB 290 [high]; Home Wireless 400 GB 1270 [high]; RED Advance+ (32 GB, 6000 min) 980 [high]; RED Elite+ (85 GB, 10000 min) 2000 [high]; RED Essential+ (16 GB, 3500 min) 575 [high]; RED Exclusive (200 GB, 11000 min) 3450 [high]; RED Prime+ (50 GB, 8000 min) 1380 [high] | web.vodafone.com.eg |
| orange_eg | egypt | Home DSL 100 Mbps (from) 880 [high]; Home DSL 200 Mbps (from) 2350 [high]; Home DSL 30 Mbps (from, 50 GB) 150 [high]; Home DSL 70 Mbps (from) 590 [high]; FREEmax 115 115 [high]; FREEmax 175 175 [high]; FREEmax 230 230 [high]; FREEmax 345 345 [high]; FREEmax 52 52 [high]; FREEmax 80 80 [high]; PREMIER Lite (15 GB, 2500 min) 520 [high]; PREMIER Platinum (70 GB, 10000 min) 1725 [high]; PREMIER Plus (20 GB, 3500 min) 690 [high]; PREMIER Select (25 GB, 5000 min) 860 [high]; PREMIER Ultra (40 GB, 7000 min) 1200 [high] | dsl.orange.eg, shop.orange.eg, www.orange.eg |
| etisalat_eg | egypt | eHome DSL 30 Mbps, 150 GB 260 [high]; eHome DSL 30 Mbps, 200 GB 330 [high]; eHome DSL 30 Mbps, 300 GB 460 [high]; eHome DSL 30 Mbps, 50 GB 150 [high]; eHome DSL 30 Mbps, 750 GB 925 [high]; Emerald 1170 (43 GB, 6500 min) 1170 [high]; Emerald 1725 (70 GB, 10000 min) 1725 [high]; Emerald 3450 (200 GB, 12000 min) 3450 [high]; Emerald 460 (13 GB, 2500 min) 460 [high]; Emerald 820 (27 GB, 4500 min) 820 [high]; Hekaya mixat (from) 52 [high] | www.eand.com.eg |
| etisalat_uae | uae | eLife Family Home Plan 376.95 [high]; eLife Lite 100 786.45 [high]; eLife Lite 12 313.95 [high]; eLife Lite 25 418.95 [high]; eLife Lite 50 628.95 [high]; eLife Ultra Fusion 855.75 [high]; eLife Unlimited Starter 408.45 [high] | www.etisalat.ae |
| crunchyroll | saudi | Fan 19.99 [medium]; Mega Fan 23.99 [medium]; Mega Fan (yearly) 209.99 [medium]; Ultimate Fan 59.99 [medium] | apps.apple.com |
| crunchyroll | uae | Mega Fan (yearly) 229.99 [medium]; Ultimate Fan 57.99 [medium] | apps.apple.com |
| starzplay | saudi | Max 49.99 [medium]; Sports 44.99 [medium] | apps.apple.com |
| starzplay | uae | Max 49.99 [medium]; Sports 49.99 [medium] | apps.apple.com |
| anghami | egypt | Plus (carrier billing) 65 [medium]; Plus (website) 2.5 USD [medium] | support.anghami.com |
| anghami | saudi | Plus 22.99 [medium]; Student 11.99 [medium] | apps.apple.com |
| anghami | uae | Family 34.49 [medium]; Student 11.99 [medium] | apps.apple.com |
| viu | saudi | Premium 29.99 [medium]; Premium (yearly) 239.99 [medium] | apps.apple.com |
| viu | uae | Premium (yearly) 239.99 [medium] | apps.apple.com |
| weyyak | saudi | Monthly 18.99 [medium]; Weekly 5.99 [medium]; Yearly 149.99 [medium] | apps.apple.com |
| weyyak | uae | Weekly 5.99 [medium]; Yearly 149.99 [medium] | apps.apple.com |
| perplexity_pro | saudi | Pro 89.99 [high]; Pro (yearly) 899.99 [high] | apps.apple.com |
| perplexity_pro | uae | Pro (yearly) 799.99 [high] | apps.apple.com |
| google_gemini | egypt | Google AI Plus 449.99 [high] | one.google.com |
| google_gemini | uae | Google AI Plus 18.99 [medium] | tbreak.com |
| microsoft_365 | egypt | Family (yearly) 2899 [high]; Personal (yearly) 2399 [high] | www.microsoft.com |
| microsoft_365 | saudi | Family 55.99 [high]; Family (yearly) 559.99 [high]; Personal 42.99 [high]; Personal (yearly) 429.99 [high] | www.microsoft.com |
| strava | uae | Summit (yearly) 229.99 [high] | apps.apple.com |
| stc_tv (new) | saudi | Monthly 32.99 [medium] | apps.apple.com |
| deezer (new) | saudi | Family 36.99 [medium]; Premium 27.99 [medium] | apps.apple.com |
| deezer (new) | uae | Family 40.99 [medium]; Premium 29.99 [medium] | apps.apple.com |
| storytel (new) | saudi | Unlimited 34.99 [high]; Unlimited (yearly) 299 [high] | storytel.com |
| storytel (new) | uae | Unlimited 9.99 USD [high]; Unlimited (yearly) 83.88 USD [high] | storytel.com |
| discord_nitro (new) | uae | Nitro Basic 11.99 [high]; Nitro 39.99 [high]; Nitro (yearly) 384.99 [high] | apps.apple.com |
| canva (new) | egypt | Business (yearly) 3400 [high]; Pro (yearly) 1920 [high] | www.canva.com |
| canva (new) | uae | Business 70 [high]; Pro 47.99 [high]; Pro (yearly) 439.99 [high] | apps.apple.com |
| proton (new) | egypt | Mail Plus 4.99 USD [high]; Mail Plus (yearly) 47.88 USD [high]; Unlimited 12.99 USD [high]; Unlimited (yearly) 119.88 USD [high] | proton.me |
| proton (new) | saudi | Mail Plus 4.99 USD [high]; Mail Plus (yearly) 47.88 USD [high]; Unlimited 12.99 USD [high]; Unlimited (yearly) 119.88 USD [high] | proton.me |
| proton (new) | uae | Mail Plus 4.99 USD [high]; Mail Plus (yearly) 47.88 USD [high]; Unlimited 12.99 USD [high]; Unlimited (yearly) 119.88 USD [high] | proton.me |
| duolingo (new) | saudi | Super 34.99 [medium]; Super (yearly) 209.99 [medium] | apps.apple.com |
| duolingo (new) | uae | Super 29.99 [medium]; Super (yearly) 199.99 [medium] | apps.apple.com |
| linkedin_premium (new) | saudi | Premium Business 299.99 [medium]; Premium Career 179.99 [medium] | apps.apple.com |
| linkedin_premium (new) | uae | Premium Business 249.99 [medium]; Premium Career 149.99 [medium] | apps.apple.com |
| headspace (new) | uae | Plus 47.99 [high]; Plus (yearly) 349.99 [high] | apps.apple.com |
| nytimes (new) | saudi | All Access (iOS) 49.99 [medium]; News (iOS) 34.99 [medium] | apps.apple.com |
| nytimes (new) | uae | All Access (iOS) 49.99 [medium]; News (iOS) 29.99 [medium] | apps.apple.com |
| medium (new) | saudi | Membership 19.99 [medium]; Membership (yearly) 199.99 [medium] | apps.apple.com |
| medium (new) | uae | Membership 19.99 [medium]; Membership (yearly) 199.99 [medium] | apps.apple.com |
| telegram_premium (new) | saudi | Monthly 20.99 [medium] | apps.apple.com |
| telegram_premium (new) | uae | Monthly 17.99 [medium]; Yearly 129.99 [medium] | apps.apple.com |
| x_premium (new) | saudi | Basic 10 [medium]; Premium 30 [medium] | apps.apple.com |
| x_premium (new) | uae | Basic 9.99 [medium]; Premium 30 [medium] | apps.apple.com |
| snapchat_plus (new) | saudi | Monthly 16.99 [medium] | apps.apple.com |
| snapchat_plus (new) | uae | Monthly 14.99 [medium] | apps.apple.com |
| talabat_pro (new) | egypt | Monthly 79 [medium]; Annual 799 [medium] | corporate.talabat.com |
| uber_one (new) | egypt | Monthly 85 [high]; Annual 850 [high] | www.uber.com |
| salam_ksa (new) | saudi | Solo 74 85.68 [medium]; Solo 99 113.85 [medium]; Solo Digital eSIM 171.35 [medium] | salammobile.sa |
| virgin_ksa (new) | saudi | Switch 120 138 [high]; Switch 150 172.5 [high]; Switch 180 207 [high]; Switch 200 230 [high]; Switch 250 287.5 [high]; Switch 300 345 [high]; Switch 365 419.75 [high]; Vnet 355 (5G home) 408.25 [high] | virginmobile.sa |
| stc_home (new) | saudi | Baity 5G Basic 200 Mbps 299 [high]; Baity 5G Entertainment 353 [high]; Baity 5G Max 862 [high]; Baity 5G Unlimited 402.5 [high]; Baity 5G Unlimited Pro 696 [high]; Baity Data Lite 30 [high]; Baity Fiber Basic 300 Mbps 287.5 [high]; Baity Fiber Entertainment 500 Mbps 460 [high]; Baity Fiber Entertainment Pro 500 Mbps 690 [high]; Baity Fiber Max 1 Gbps 920 [high]; Baity Fiber Stream 500 Mbps 402.5 [high]; Baity Fiber Stream Pro 500 Mbps 575 [high]; Baity Stream Lite 500 Mbps 345 [high] | www.stc.com.sa |
| mobily_home (new) | saudi | Home Fiber Postpaid 1 Gb 552 [high]; Home Fiber Postpaid 300 172.5 [high]; Home Fiber Postpaid 400 207 [high]; Home Fiber Postpaid 500 241.5 [high]; Home Fiber Gamers 500 Mbps 402.5 [high]; Home FTTR 1 Gbps 920 [high]; Home FTTR 400 402.5 [high]; Home FTTR 500 460 [high] | www.mobily.com.sa |

## Re-verified, price unchanged

- apple_music / saudi: 1 plan(s)
- claude_pro / egypt: 2 plan(s)
- disney_plus / saudi: 2 plan(s)
- disney_plus / uae: 2 plan(s)
- icloud / saudi: 5 plan(s)
- icloud / uae: 5 plan(s)
- mobily / saudi: 5 plan(s)
- netflix / egypt: 3 plan(s)
- netflix / saudi: 3 plan(s)
- netflix / uae: 3 plan(s)
- prime_video / egypt: 2 plan(s)
- prime_video / saudi: 2 plan(s)
- prime_video / uae: 2 plan(s)
- shahid_vip / egypt: 5 plan(s)
- spotify / egypt: 4 plan(s)
- spotify / saudi: 3 plan(s)
- spotify / uae: 3 plan(s)
- stc / saudi: 4 plan(s)
- zain_ksa / saudi: 7 plan(s)

## Left unpriced (brand stays available, no plan prefill)

Existing brand/region that lost every plan: apple_fitness/egypt, apple_fitness/uae, apple_tv_plus/egypt, apple_tv_plus/saudi, apple_tv_plus/uae, audible/egypt, audible/uae, crunchyroll/egypt, cursor/egypt, cursor/uae, dropbox/egypt, dropbox/uae, du_home/uae, ea_play/saudi, ea_play/uae, expressvpn/egypt, expressvpn/uae, grammarly/egypt, grammarly/uae, kindle_unlimited/egypt, midjourney/egypt, midjourney/uae, mubi/egypt, mubi/uae, myfitnesspal/egypt, myfitnesspal/uae, perplexity_pro/egypt, scribd/egypt, starzplay/egypt, strava/egypt, surfshark/egypt, surfshark/uae, tod/uae, viu/egypt, weyyak/egypt, xbox_gamepass/saudi, xbox_gamepass/uae, yango_play/egypt, youtube_music/egypt, youtube_music/uae, zoom_pro/egypt, zoom_pro/uae

New brands without plans (research low/unverified or no price): adobe_creative_cloud/egypt, adobe_creative_cloud/saudi, adobe_creative_cloud/uae, anytime_fitness/saudi, anytime_fitness/uae, apple_arcade/egypt, apple_arcade/saudi, apple_arcade/uae, bein_sports/egypt, bein_sports/uae, bitwarden/egypt, bitwarden/saudi, bitwarden/uae, bumble/egypt, bumble/saudi, bumble/uae, calm/egypt, calm/saudi, calm/uae, canva/saudi, careem_plus/egypt, careem_plus/saudi, careem_plus/uae, classpass/uae, coursera/egypt, coursera/saudi, coursera/uae, deezer/egypt, deliveroo_plus/uae, discord_nitro/egypt, discord_nitro/saudi, duolingo/egypt, economist/egypt, economist/saudi, economist/uae, evernote/egypt, evernote/saudi, evernote/uae, figma/egypt, figma/saudi, figma/uae, fitness_first/uae, fitness_time/saudi, fortnite_crew/egypt, fortnite_crew/saudi, fortnite_crew/uae, golds_gym/egypt, golds_gym/saudi, golds_gym/uae, gymnation/uae, headspace/egypt, headspace/saudi, hungerstation/saudi, jahez/saudi, lebara_ksa/saudi, linkedin_premium/egypt, masterclass/egypt, masterclass/saudi, masterclass/uae, medium/egypt, noon_one/egypt, noon_one/saudi, noon_one/uae, nytimes/egypt, onepassword/egypt, onepassword/saudi, onepassword/uae, patreon/egypt, patreon/saudi, patreon/uae, skillshare/egypt, skillshare/saudi, skillshare/uae, snapchat_plus/egypt, starlink/egypt, storytel/egypt, substack/egypt, substack/saudi, substack/uae, talabat_pro/uae, telegram_premium/egypt, tinder/egypt, tinder/saudi, tinder/uae, twitch/egypt, twitch/saudi, twitch/uae, uber_one/saudi, uber_one/uae, ubisoft_plus/egypt, ubisoft_plus/saudi, ubisoft_plus/uae, virgin_uae/uae, x_premium/egypt, zain_home/saudi

Existing brands newly available in a region, unpriced: expressvpn/saudi, google_gemini/saudi, google_one/saudi, gym/saudi, mubi/saudi, surfshark/saudi, xbox_gamepass/egypt, youtube_premium/saudi

## Decisions and risks

- Plan ids: kept for every plan that still exists. Removed ids (listed above) simply stop resolving: `plansForRegion(...).find` returns undefined, `planForAmount` returns null, the edit sheet falls back to plan index 0, and the stored `planName`/`amount` on the subscription are untouched. No tombstones were added.
- `currency` is set only where the provider bills a fixed currency different from the region: OSN+ web (Egypt, USD), Anghami website (Egypt, USD), Storytel (UAE, USD), NordVPN / Proton / Claude Max (USD), the existing ChatGPT / Claude / Notion / Slack / Copilot USD web plans. ChatGPT is EGP in Egypt; in UAE/KSA the USD web plan is kept and the Apple-billed AED/SAR price is a separate `*_appstore` plan.
- PlayStation Plus UAE/KSA moved from USD to local-store AED/SAR (high). Egypt still has no PlayStation Store locale.
- e& eLife prices are listed ex-VAT by e&; the catalog stores listed + 5% VAT (same convention as the SAR plans, which include 15% VAT).
- NordVPN: only the 27-month deals are verified; they are billed upfront, stored as the monthly equivalent (description says so). Picking one gives a monthly-equivalent figure, not the lump-sum charge.
- Emirati-national e& mobile plans and Mobily `Home Fiber Postpaid 200` (price equals the mobile plan of the same name, inconsistent with the 300/400/500 series) were not added.
- Not added: Tabby/Tamara (BNPL), Absher/Sadad/Salik/Darb/Nol/Hafilat (government/payment), cloud infra (AWS, GoDaddy, Namecheap, Cloudflare, DigitalOcean), Careem Pay, Carrefour MyClub, Swvl/inDrive/Rabbit/elmenus/Breadfast/InstaShop/Mrsool/Vezeeta/Chefaa (not subscriptions), Apple One (redirects to iCloud+), Arab News+/The National/Gulf News/Noon Academy/Whoop.
- Careem Plus UAE 29 AED and Uber One KSA 17 SAR are `medium` but carry no `checked_at`, so they were not prefilled. Deliveroo Plus 228/year is a value quoted on an Amazon page, not a price.
- Merchant aliases: bare `uber`, `noon`, `talabat`, `careem`, `orange`, `etisalat`, `salam`, `virgin`, `plus`, `pro`, `club`, `gym` and the Arabic words for them are intentionally NOT aliases (they are bigger, different merchants and `catalogCategory`/`normalizeMerchant` would mislabel them). `calm` and `medium` joined `gym` in `GENERIC_BRAND_KEYS`. The Arabic resolver now picks the longest matching phrase, so "يوتيوب ميوزك" is YouTube Music, not YouTube Premium.
- Egypt entries kept because research had no contradicting row: Apple Music family/student, TOD (Egypt), Kindle Unlimited / Scribd / Yango Play (UAE), du Mobile Postpaid 125, Microsoft 365 (UAE), gym placeholder, Notion/Slack/GitHub Copilot USD plans (research low rows agree or differ only by monthly-vs-annual billing).
- New brands show the initials tile until `logoPolicy.ts` / `public/subscription-icons` (owned by the logo step) are updated; keys follow the existing `LOGO_POLICY` keys (`bein_sports`, `onepassword`, `adobe_creative_cloud`, `coursera`, `golds_gym`, `starlink`, ...).
