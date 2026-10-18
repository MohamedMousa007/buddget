# CHANGES_GCC: existing app prices (src/lib/constants/subscriptionCatalog.ts, regions 'uae' and 'saudi') vs verified, 2026-10-17

"verified" = read on an official page today. Many existing rows carry verifiedAt 2026-07-17, so a "WRONG" below means the price moved or was mislabelled since. Repo not edited.

## Wrong or stale (high/medium evidence)
| Region | App brand / plan | App has | Verified | Evidence |
|---|---|---|---|---|
| UAE + KSA | apple_music Individual | 21.99 | 23.99 AED / 23.99 SAR | apple.com/ae|sa/apple-music (high) |
| UAE + KSA | apple_music Family | 33.99 | 39.99 | same |
| UAE | apple_music Student | 11.99 | 12.99 (KSA 12.99 already correct) | same |
| UAE + KSA | apple_tv_plus "Apple TV" | 27.99 / 29.99 | no standalone price: "Apple TV is available with an iCloud+ subscription" | apple.com/ae|sa/apple-tv-plus, /icloud (high). Do not prefill. |
| UAE + KSA | playstation_plus (all 9 rows) | USD (8.99/13.49/15.99 monthly...) | bills in local store currency: SAR Essential 33.99/85.99/243.99, Extra 49.99/141.99/399.99, Deluxe 59.99/164.99/469.99; AED 32.99/84.99/239.99, 49.99/139.99/396.99, 58.99/161.99/459.99 (1/3/12 months) | playstation.com/en-sa|en-ae/ps-plus (high) |
| UAE | youtube_premium Individual / Family | 23 / 35 | 29.99 / 57.99 AED (Sept 2026 hike, from 26.99/49.99) | press + AE App Store (medium); KSA web price not readable (iOS 39.99 / 74.99 low) |
| UAE | youtube_music Individual / Family | 23 / 35 | iOS 31.99 / 47.99 AED | AE App Store (low) |
| UAE | osn_plus Monthly / Annual | 30 / 300 | Standard 48.99, Premium 64.99 AED/mo; Standard ads 29.99; yearly 489.99 / 649.99 (App Store, medium). KSA: Standard 48.99, Premium 69.99 SAR on Mobily page (high) | KSA row missing in app |
| UAE | google_one 100 GB / 2 TB | 7 / 37 | 2 TB tier is now "Google AI Pro (2TB)" 76.99 AED; Google AI Plus 18.99; 100 GB 7.99 (low) | tbreak quoting Google UAE page (medium) |
| UAE | chatgpt_plus Plus | 20 USD | App Store billing 79.99 AED (KSA 89.99 SAR); web likely USD 20. Go 29.99 AED / 35 SAR; Pro 100/200/500 | apps.apple.com ae/sa (high for store price) |
| UAE + KSA | claude_pro Pro | 20 USD / 17 USD annual-monthly | App Store: Pro 79.99 AED / 89.99 SAR monthly, annual 799.99 AED / 999.99 SAR; Max 5x 499.99, Max 20x 999.99 | apps.apple.com (high store). Web stays USD. |
| UAE | xbox_gamepass Essential/Premium/Ultimate | 7.99 / 10.99 / 15.99 USD | USD list is stale (Ultimate went to 29.99 USD in Oct 2025; later cut in some markets). No official AED price found (Ultimate about 110 AED conversion, low) | unverified |
| KSA | xbox_gamepass | 29.99 / 39.99 / 60.99 SAR | sources conflict (Ultimate 84.99 in Oct 2025 news, 39.99 promo); low | unverified |
| UAE | microsoft_365 Personal / Family | 35 / 55 monthly | Microsoft Store UAE shows no price. KSA: Personal 42.99/mo or 429.99/yr, Family 55.99/mo or 559.99/yr SAR (high). UAE FX estimate 421/549 AED per year (low) | microsoft.com/en-sa (high) |
| KSA | microsoft_365 | no KSA plans in app | add the SAR plans above | |
| KSA | stc "Mofawtar 2" 138 | 145 ("mofawtar 2 lite") | stc.com.sa (high) |
| KSA | stc "Mofawtar 2 Plus" 172.5 | 180 ("2 extra") | same |
| KSA | stc "Mofawtar 4" 517.5 | 460 ("4 extra") | same |
| KSA | stc Basic Plus 90, 3 Plus 264.5, Flex 370, MAX 920 | match | match | |
| KSA | mobily Postpaid 200 / 400 | 230 / 460 | match (high). 150/300/XStream match at medium. Postpaid 65/100/XStream Plus/Max could not be re-read | |
| KSA | zain_ksa 75..650, Black 1000 | match | match (high) | |
| UAE | etisalat_uae eLife Basic 319 / Plus 449 | names and prices differ | e& eLife Lite 12/25/50/100 = 299/399/599/749, Unlimited Starter 389, Ultra Fusion 815, Family 359 AED, all excl 5% VAT (high) | rename/replace |
| UAE | du_home 299 / 449, du_mobile 125 / 200 | unchanged | du.ae unreadable (SPA/DNS); aggregators: Home 389..749, Power Plan 125/150/225 (low) | unverified |
| UAE | nordvpn 46, expressvpn 50, surfshark 35 | AED rounded guesses | global USD plans (Nord 3.49-4.49/mo 27-month intro etc, Express 12.95, Surfshark Starter 15.45 monthly) (low) | |
| UAE | crunchyroll Fan 25 / Mega 35 | | Fan 21.99, Mega Fan 25.99, Ultimate 57.99 AED (App Store, medium) |
| UAE | anghami Plus 15 / Platinum 25 | | Plus 22.99, Student 11.99, Family 34.49 AED (App Store, medium) |
| UAE | starzplay 40 | | 34.99-49.99 depending on SKU (App Store, low/medium) |
| UAE | tod Entertainment 35 / Sports 55 | | App Store 39.99 / 69.99 / 4K 109.99 (low) |
| UAE | viu Premium 20 | | 29.99 monthly, 239.99 yearly (medium) |
| UAE | weyyak 25 | | 18.99 monthly, 5.99 weekly, 149.99 yearly (medium) |
| UAE | cursor Pro 80 / Business 120 | | USD billed: Pro 20 USD, Ultra 200 USD (low) |
| UAE | midjourney 40 / 80 | | USD: Basic 10, Standard 30, Pro 60 (low) |
| UAE | perplexity_pro 80 | | 79.99 AED monthly / 799.99 yearly (App Store, high store) |
| UAE | google_gemini "Google AI Pro" 75 | | 76.99 AED (medium) |
| UAE | grammarly 45, dropbox 45/120, zoom 55, myfitnesspal 40, strava 40, kindle 35, audible 45, scribd 40, apple_fitness 35, mubi 40 | AED guesses | Strava 29.99 AED mo / 229.99 yr (high store); others USD or not offered locally (low); apple_fitness unverified (may not be sold in KSA/UAE); scribd, kindle not found |
| UAE | ea_play 5.99 USD (KSA 24 SAR) | | EA Play 4.99 USD / 29.99 yr (low); KSA SAR unverified |
| both | disney_plus 49.99 / 449.9 | match | match (high) |
| both | netflix 35/49/71 | match | match (high) |
| both | spotify 23.99/59.99/12.99 | match | match (high); extra: 1-year prepaid 239; no Duo/Family listed |
| both | icloud | match | match (high) |
| both | prime_video 16 / 140 | match | match (high) |
| both | notion, slack, github_copilot (USD) | | not verifiable from AE/SA (global USD plans), low |

## Missing from the app (brands/plans added in the catalog)
Shahid has NO uae/saudi plans in the app (egypt only): App Store SA/AE = VIP 44.99, VIP|Sports 69.99, Ultimate 89.99, BigTime 54.99 (medium, Apple-billed). Also missing: stc tv, Jawwy TV plans, Storytel (KSA 34.99/mo, 299/yr, 192/6mo SAR high), Uber One KSA 17 SAR/mo, noon One, talabat Pro, Careem Plus (AED 29 from Jul 2026), HungerStation Plus, Deliveroo Plus, Virgin Mobile KSA, Salam, Lebara, du Elite Super, e& Emirati, Smiles, home fiber (stc Baity, Mobily Fiber, Zain Home), Discord Nitro (39.99 AED), Canva (47.99 AED mo), Headspace (47.99), LinkedIn, Duolingo, Tabby/Tamara (BNPL note), gyms.
