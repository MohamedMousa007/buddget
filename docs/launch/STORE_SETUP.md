# Store setup: App Store Connect and RevenueCat (iOS)

State as of 2026-11-18. Everything below was created through RevenueCat's App Store Connect integration; nothing has been submitted to Apple's review yet (products go in with the next app version).

## Identifiers

| Thing | Id |
|---|---|
| RevenueCat project | `projb9480b99` (dashboard `b9480b99`) |
| RevenueCat iOS app | `app5008c2628f`, bundle `app.buddget` (test store `app79df340a6c` keeps the two sample products) |
| Entitlement | `buddget_pro` (`entlf059063abf`): `pro_monthly`, `pro_annual` and the two test-store products |
| Offering | `default` (`ofrng2f566520c6`, current): `$rc_monthly` -> `pro_monthly`, `$rc_annual` -> `pro_annual` |
| Webhook | `buddget server` -> `https://buddget.app/api/billing/revenuecat`, all events |
| Subscription group | `Buddget Pro` (22586479), EN and AR group names |

## Products (App Store Connect, all `READY_TO_SUBMIT`)

| Store id | Type | Where | Base prices | RevenueCat id |
|---|---|---|---|---|
| `pro_monthly` | subscription 1M | all | EGP 69.99, AED/SAR/QAR 19.99, USD 4.99 (+ the price file) | `prodc5ccfbb979` |
| `pro_annual` | subscription 1Y | all | EGP 499.99, AED/SAR/QAR 99.99, USD 24.99 | `prod0ad078c15f` |
| `sparks_60` | consumable | Egypt only | EGP 9.99 | `prodd147bde401` |
| `sparks_125` | consumable | Egypt only | EGP 19.99 | `prod1590e273c2` |
| `sparks_320` | consumable | all | USD 0.99, EGP 49.99, AED 3.99, SAR 3.99 | `proda672624d98` |
| `sparks_650` | consumable | all | USD 1.99, EGP 99.99, AED 7.99, SAR 7.99 | `prod6a4746ceae` |
| `sparks_2000` | consumable | all | USD 4.99, EGP 299.99, AED 18.99, SAR 21.99 | `prod7d24d8173c` |

Every product has EN + AR name and description, review notes, and a real review screenshot from the app (a stand-in member, `docs/design/pro-rewards/store/review/`). Both subscriptions have the privacy policy URL. No introductory offer on purpose: the 30-day trial is granted in-app without a card.

## Stay (retention) offers, board 3-0 / council majority, 2026-11-18

Same terms in every market; Egypt is the thin one and stays above its AI cost ceiling (USD 0.45 a month) in both cases.

| Product | Offer id | Terms | Egypt | AE/SA/QA | USD |
|---|---|---|---|---|---|
| `pro_monthly` | `stay30_2m` | 30% off, pay as you go, 2 months | EGP 48.99 | 13.99 | 3.49 |
| `pro_annual` | `stay_annual_20` | 20% off, one year paid upfront | EGP 399.99 | 79.99 | 19.99 |

Other territories are Apple's equalised price from USD. Rules the app must enforce (Apple does not): one redemption per account per lifetime, checked on the server; lapsed users only after 30 days away; shown once when someone taps to cancel, never stacked with points-shop discounts, no points for accepting. Offer terms cannot be edited: to change one, create a new id and delete the old. Deleted ids (`stay_half_3m`, `stay_annual_30`) can never be reused.

**Built (migration 0317):** on iOS, "How to cancel" in the Manage sheet first asks `GET /api/billing/stay-offer`, which reads `stay_offer_state` (entitlement status, source, product, `user_entitlements.stay_offer_redeemed_at`, an EXPIRATION in the last 30 days) and applies the rule in `src/lib/billing/stayOffer.ts`. Eligible members see one card (title, what they keep, "Stay with Pro", "Cancel anyway"); the button signs the App Store discount through RevenueCat (`purchaseWithOffer`: `getPromotionalOffer` then `purchaseDiscountedPackage`). The redemption is stamped twice, idempotently: by the app right after the purchase (`POST /api/billing/stay-offer`) and by the webhook when a RENEWAL or INITIAL_PURCHASE carries the offer in `offer_code` or `discount_identifier`. Android and web go straight to the cancel steps.

**Apple retention messaging (App Store Connect, 2026-11-18):** message `buddget pro` (Prepare for Submission, not yet added for review) is shown on Apple's own cancel sheet for both subscriptions. EN + AR header and body (benefits only, no prices, as Apple requires); no image yet (3840 x 2160 optional). Each subscription carries its own retention offer, same terms as the in-app stay offers; these are separate Apple objects with their own ids:

| Product | Retention offer id | Terms | Egypt | AE/SA/QA | USD |
|---|---|---|---|---|---|
| `pro_monthly` | `retain_monthly_30` | pay as you go, 2 months | EGP 48.99 | 13.99 | 3.49 |
| `pro_annual` | `retain_annual_20` | pay up front, 1 year | EGP 399.99 | 79.99 | 19.99 |

Eligibility: paid for at least 1 month, 24 months between offers, all 175 territories. Apple's auto-conversion was wrong for our markets (it proposed EGP 999.99 and EGP 199.99, and Poland at full price), so those were set by hand; check every row after any edit. The webhook treats both ids as the account's one stay offer (`APPLE_RETENTION_OFFERS` in `stayOffer.ts`), so a member who takes Apple's offer never also gets the in-app one. Sparks packs are consumables and cannot have retention messages.

**Not built yet:** Apple's win-back offers for lapsed subscribers.

## Owner steps still open

1. Vercel: `NEXT_PUBLIC_REVENUECAT_IOS_KEY` (public SDK key from the RevenueCat app page), `REVENUECAT_WEBHOOK_AUTH` (the Authorization header value set on the webhook in RevenueCat), `REVENUECAT_WEBHOOK_HMAC_SECRET` (the webhook signing secret). The server refuses every event until both webhook values are set.
2. App Store Connect, app level: turn on the Billing Grace Period (3 days, all renewals, production and sandbox; owner choice 2026-11-18); set the App Store Server Notifications V2 URL to the one RevenueCat shows on the iOS app page; confirm the Paid Apps agreement, banking and tax are active; confirm Small Business Program enrolment (the 15% the plan assumes).
3. Optional: upload `docs/design/pro-rewards/store/buddget-pro-*-card-1024.png` as each subscription's promotional image (Apple shows it in the App Store subscription list); decide Family Sharing (off; cannot be turned off again once on).
4. Android: a Google Play service account in RevenueCat, then the same products in Play Console (`pro_monthly:monthly`, `pro_annual:annual`, the packs).
5. Submit the in-app purchases with the next app version and run one sandbox purchase of each kind.

## Android (Google Play): progress

- Play Console developer account created (personal, trader declared); identity verification pending with Google, so creating the app is blocked until it clears.
- Google Cloud project `Buddget` (`gen-lang-client-0929604237`, owned by the same Google account): Google Play Android Developer API, Google Play Developer Reporting API and Cloud Pub/Sub API enabled.
- Service account `revenuecat@gen-lang-client-0929604237.iam.gserviceaccount.com` with Pub/Sub Admin and Monitoring Viewer only.
- Service account JSON key created by the owner and kept offline (not in the repo).
- RevenueCat Play Store app `app86a098cc89` (`buddget Android`, package `app.buddget`) created 2026-11-18; credentials not uploaded yet.
- 2026-11-19: Play identity verification cleared. App created in Play Console ("buddget: AI Budget Tracker", `app.buddget`, personal account, Free). App content done: privacy policy, ads (none), content rating (Everyone / PEGI 3), government (no), financial features (none), advertising ID (no), health (none), trader (yes + terms URL), Data safety. Open: Sign in details (reviewer demo account), Target audience, store listing, release AAB, SMS permission declaration, monetization products, closed test (personal account: 12 testers for 14 days before production).
- Next (owner): create its JSON key (Keys -> Add key -> JSON), keep it with the App Store keys. After Play verification: create the app, invite the service account in Play Console with View app information, View financial data, Manage orders and subscriptions; add a Play Store app in RevenueCat for `app.buddget` and upload the JSON; connect Google developer notifications and paste the topic in Play Console's Monetization setup.

## Re-running

Prices and offers are read live from Apple with `get-product-store-state`; changes go through `create-product-store-state-plan` -> plan -> apply (review the diff first). Review screenshots: `upload-product-store-state-screenshot` reserves a slot, PUT the bytes to the returned URL, then set `screenshot_id` + MD5 in a plan.

---

# S9 additions (2026-11-20): listing, screenshots, open owner steps

Prepared content only. Nothing was entered in App Store Connect, Play Console or RevenueCat. Privacy answers: `docs/launch/PRIVACY_DECLARATIONS.md`. Older listing copy: `docs/launch/S6-store-listing.md` (still correct for the Pro, trial and subscription-terms text; its lead and screenshot order are replaced below).

## Listing copy v2 (leads with privacy, no-SMS use, Arabic, installments; not with AI)

Why changed (S5a business review): bank-SMS apps already exist in Egypt and the UAE, so no "only app that" wording; "Free. No ads." is gone (billing is on); the measured-accuracy claim is **held**: `docs/launch/S8f-bank-accuracy.md` shows no Egyptian bank at "supported" (NBE and CIB partial, the rest not enough data), so S5c gate 1 is not met. Until the per-bank table is published, the copy names no accuracy figure and no "supported" bank list. When gate 1 passes, add one line: "Reads texts from <banks in the published table>".

Egypt first. UAE and Saudi listings stay plain until their bank tables exist.

### English

- **Name (30):** buddget: Budget & Expenses
- **Subtitle (App Store, 30):** Private. Arabic. Automatic.
- **Promotional text (170):** Your texts stay yours: buddget reads only the messages you allow, and works fine without any. Full Arabic. Track installments and BNPL. 30 days of Pro on us.
- **Short description (Google Play, 80):** Budget and track spending in Arabic or English. SMS is optional. You decide.
- **Keywords (App Store, 100):** budget,expense,tracker,egp,arabic,installments,bnpl,savings,debt,goals,sms,wallet,bills,money
- **Description:**

  Know what is safe to spend today, in Arabic or English.

  buddget tracks your spending, bills, debts, goals and installments in one place, in Egyptian pounds and other currencies. No bank login, ever.

  Private by design
  - Reading bank texts is optional and off until you turn it on. The app works fully without it.
  - On Android only incoming texts are seen, never your inbox. On iPhone, a Shortcut you create sends them.
  - Only business-sender and transaction-like messages leave your phone; the raw text is deleted within weeks.
  - No ads, no advertising ID, no selling your data. Delete your account in the app any time.

  Built for how people really pay
  - Installments and buy-now-pay-later plans with due dates
  - Subscriptions, cards, wallets and cash
  - Budgets, goals, debts and reports you can export
  - Add by voice or by scanning a receipt
  - Full Arabic, not just translated labels

  Free forever: tracking, budgets, goals, debts, reports, and a weekly allowance of Buddgy, our assistant.
  buddget Pro: about 10x the assistant, voice and receipts, the Advisor, unlimited saved budgets.

  30 days of Pro on us. Every new account starts with every Pro feature for 30 days, no card. After that you move to Free automatically; nothing is charged and nothing is deleted.

  Subscription terms, privacy and terms links: the block in `S6-store-listing.md` ("Subscription terms (required text)"), unchanged.

### Arabic

- **الاسم:** buddget: ميزانية ومصروفات
- **العنوان الفرعي:** خاص. عربي. تلقائي.
- **النص الترويجي:** رسائلك تبقى لك: يقرأ buddget الرسائل التي تسمح بها فقط، ويعمل جيدًا بدونها. عربي كامل. تابع الأقساط وخدمات اشتر الآن وادفع لاحقًا. 30 يومًا من Pro علينا.
- **الوصف القصير (Google Play):** ميزانية ومصروفات بالعربية أو الإنجليزية. الرسائل اختيارية، والقرار لك.
- **الوصف:**

  اعرف ما يمكنك إنفاقه اليوم بأمان، بالعربية أو الإنجليزية.

  يتابع buddget مصروفاتك وفواتيرك وديونك وأهدافك وأقساطك في مكان واحد، بالجنيه المصري وعملات أخرى. بلا تسجيل دخول إلى البنك، أبدًا.

  خصوصية من الأساس
  - قراءة رسائل البنك اختيارية ومعطّلة حتى تفعّلها. والتطبيق يعمل كاملًا بدونها.
  - على أندرويد يرى التطبيق الرسائل الواردة فقط، لا صندوق الوارد. وعلى iPhone يرسلها اختصار تنشئه أنت.
  - لا يغادر هاتفك إلا رسائل الجهات التجارية والرسائل الشبيهة بالمعاملات، ويُحذف نصها الخام خلال أسابيع.
  - بلا إعلانات ولا معرّف إعلانات ولا بيع لبياناتك. احذف حسابك من التطبيق متى شئت.

  مصمم لطريقة الدفع الفعلية
  - الأقساط وخطط اشتر الآن وادفع لاحقًا مع مواعيد الاستحقاق
  - الاشتراكات والبطاقات والمحافظ والنقد
  - ميزانيات وأهداف وديون وتقارير قابلة للتصدير
  - أضف بالصوت أو بمسح إيصال
  - عربي كامل، لا مجرد عناوين مترجمة

  مجاني للأبد: التتبع والميزانيات والأهداف والديون والتقارير، وحصة أسبوعية من Buddgy مساعدنا.
  buddget Pro: حوالي 10 أضعاف المساعد، والصوت والإيصالات، والمستشار، وميزانيات محفوظة بلا حد.

  30 يومًا من Pro علينا. كل حساب جديد يبدأ بكل ميزات Pro لمدة 30 يومًا بلا بطاقة. وبعدها تنتقل تلقائيًا إلى المجاني؛ لا يُخصم شيء ولا يُحذف شيء.

Paywall copy (separate task, same rules): normal price and the founding end date, no crossed-out price, the yearly amount as the main annual price, no founding price, no "guarantee"; refund wording is the Terms 7A text.

### Store fields that must match the build

- Support URL: `https://buddget.app` support page or `support@buddget.app`; Marketing URL: `https://buddget.app`; Privacy: `https://my.buddget.app/privacy`; Terms: `https://my.buddget.app/terms`.
- Age rating: 4+ (Apple), PEGI 3 / Everyone (Play), already set on Play. No user-generated content shared with others, no gambling (loyalty points have no cash value and no chance).
- Category: Finance (primary). Copyright: 2026 buddget.
- Reviewer notes and demo account: `PRIVACY_DECLARATIONS.md` section 6. Demo persona **Layla Hassan** with seeded EGP data; use the `__qa` seed helpers (`docs/QA_CLOUD.md`) on a fresh account in the Frankfurt project, not a real person.

## Screenshot shot list

All screens show the persona **Layla Hassan** and invented merchants and amounts, never a real person's data. Capture English and Arabic; Arabic keeps the English-order layout for launch (QA-27). Light theme for the first set, dark as the second set if time allows. Captions: the six in `S6-store-listing.md`, re-ordered to the story below.

### Story order (same on every device class)

1. **Today's number:** home with "safe to spend today" and the month ring. Caption: What can you spend today? One number, calculated for you.
2. **Private by design:** Settings > SMS Tracking with the off-by-default switch and the "works without SMS" line. Caption: Your texts stay yours. You decide.
3. **A bank text becomes a transaction:** Flow list with an SMS-sourced expense and its source chip. Caption: Every bank text, sorted without typing.
4. **Installments and BNPL:** debts page with a BNPL plan and its due dates. Caption: Installments and pay-later plans, never missed.
5. **Full Arabic:** the same home or Flow screen in Arabic. Caption: عربي كامل.
6. **Ask Buddgy** (voice or chat answering from the numbers). Caption: Ask Buddgy. It answers from your own numbers.
7. **Pro and the trial:** Plan and billing in Trial state. Caption: 30 days of Pro on us. No card.
8. (optional) **Rewards and invites** screen.

### iPhone (App Store)

- Required: **6.9-inch** (1320 x 2868) or, if absent, 6.5-inch (1284 x 2778); Apple scales down for the smaller sizes. 3 to 10 screenshots; use 7.
- Source: the iOS Simulator on the store build (iPhone 17 Pro Max), not the web. **Waits for the owner's build instruction.**

### iPad (App Store, required because the app supports iPad, `TARGETED_DEVICE_FAMILY = 1,2`)

- Required: **13-inch** (2064 x 2752 portrait, or 2752 x 2064 landscape); 12.9-inch (2048 x 2732) is accepted as the fallback. 3 to 10 screenshots; use 5: 1 today's number, 3 Flow, 4 installments, 5 Arabic, 7 Plan and billing.
- Source: iPad Pro 13-inch simulator, portrait first, one landscape set if the layout differs (S7b walks both). **Waits for the build.**

### Google Play

- Phone: 1080 x 1920 or larger, 16:9 or 9:16, 2 to 8; use 7 (the story above). Current files in `docs/launch/play-assets/phone-*.png` are the pre-redesign set and must be replaced.
- 7-inch and 10-inch tablet: 1200 x 1920 and 1600 x 2560 (optional but lifts tablet ranking; use 4).
- Feature graphic 1024 x 500 and icon 512 x 512 exist in `docs/launch/play-assets/`; refresh the feature graphic to the new lead ("Private. Arabic. Automatic.").
- Source: Android emulator on the store build. **Waits for the build.**

### What can be scripted now (cloud qa-runner, Playwright; listed, not run here)

These need no native build. They use the existing suites first: `e2e/ui/sweep.mjs` (viewport x theme x locale), `e2e/ui/seed.ts`, `e2e/ui/pro-rewards-sweep.mjs`. Add one new spec, `e2e/ui/store-shots.mjs`, in the same style (fresh synthetic `qa-e2e-*` user with the Layla Hassan persona, seeded through the `__qa` helpers, deleted at the end, zero left), and list it in `e2e/README.md`.

| Capture | Route | Viewport | Locale x theme | Use |
|---|---|---|---|---|
| Today's number | `/` (home) | 430 x 932 | en, ar x light, dark | Play phone, web store badge preview |
| SMS settings, off by default | `/settings/sms` | 430 x 932 | en, ar x light | Privacy screenshot, marketing site |
| Flow with an SMS-sourced row | `/flow` | 430 x 932 | en, ar x light | Phone set |
| Installments / BNPL | `/debts` | 430 x 932 | en, ar x light | Phone set |
| Plan and billing, trial | `/settings/pro` | 430 x 932 | en, ar x light, dark | Phone set, paywall preview |
| Rewards and invite | `/settings/rewards`, `/settings/invite` | 430 x 932 | en, ar x light | Optional |
| Tablet set | the five above | 768 x 1024 and 1024 x 768 | en x light | Play 7-inch and 10-inch (resize to 1200 x 1920 / 1600 x 2560 with device scale factor), cross-check for iPad layout |
| Marketing site home, privacy and terms | `/`, `/legal/privacy`, `/legal/terms` (en and ar site) | 1440 x 900 and 390 x 844 | en, ar x dark, light | Check legal text rendering after S9; site hero shots |

Playwright notes: `deviceScaleFactor: 3` for crisp phone shots, `reducedMotion: 'reduce'`, wait for fonts and the locale (`document.fonts.ready`, `html[lang]`), hide the dev overlay, screenshots to a git-ignored folder, only the summary line in the report. These web captures are a draft and a layout check; the store images are the simulator and emulator ones from the build.

## Owner steps still open

### Play Console (app.buddget, created 2026-11-19)

From the Play Console memory, `STORE_SETUP.md` above and `docs/MASTER_PLAN_LAUNCH.md` H0:

1. **RECEIVE_SMS permission declaration:** submit the Permissions Declaration Form with the 30-second recording (script and justification text in `docs/GOOGLE_PLAY_SUBMISSION.md` section 3). A rejection blocks the core feature, so this goes first.
2. **Closed test:** personal account needs 12 testers for 14 days before production. Add testers, start the test track as soon as an AAB exists. This drives the launch date.
3. **App content, still open:** Sign-in details (a reviewer demo account, Layla Hassan persona, fresh in the Frankfurt project, credentials only in the form); Target audience (18+, not for children); re-open **Data safety** and enter the table in `PRIVACY_DECLARATIONS.md` section 4 (the memory lists Data safety as both done and open: re-check every row, it predates the AD_ID and Facebook removal and the purchase and invite data); Advertising ID stays No.
4. **Store listing:** title, short and long description (v2 above, EN and AR translations in Manage translations), icon, feature graphic, phone and tablet screenshots, category Finance, contact email, privacy URL.
5. **Release:** upload the signed AAB (needs the owner's build instruction), release notes, countries (Egypt first), staged rollout.
6. **Monetization:** create `pro_monthly:monthly`, `pro_annual:annual` and the Sparks products, link the service account (View app information, View financial data, Manage orders and subscriptions), connect Google developer notifications and paste the Pub/Sub topic; upload the JSON key in RevenueCat (`app86a098cc89`); RevenueCat webhook secrets in Vercel (iOS section, item 1).
7. **Pre-launch report** and Android vitals review before promoting past the closed test.

### App Store Connect (iOS, bundle `app.buddget`)

1. **Agreements:** confirm Paid Apps agreement, banking and tax are active; Small Business Program enrolment (the 15% the plan assumes).
2. **Subscriptions:** Billing Grace Period (3 days), App Store Server Notifications V2 URL from RevenueCat, optional promotional images, Family Sharing decision (off). Submit the subscriptions and Sparks packs **with the next app version** and run one sandbox purchase of each kind.
3. **App Privacy:** enter the table in `PRIVACY_DECLARATIONS.md` section 2; tracking: No.
4. **App information:** name, subtitle, promotional text, description, keywords (v2 above), EN and AR localisations, support and marketing URLs, privacy URL, category Finance, age rating questionnaire, copyright.
5. **Screenshots:** iPhone 6.9-inch and iPad 13-inch sets from the build (list above), plus Arabic set.
6. **App Review information:** the demo account and notes from `PRIVACY_DECLARATIONS.md` section 6; add the retention message `buddget pro` for review with the version.
7. **Build:** TestFlight build after the owner's word (the current builds, TestFlight 145 and Android vc178, predate the QA fixes, so a new build is needed before the store build and screenshots).
8. **Support:** Sign in with Apple stays on; account deletion path named in the review notes.

### Both consoles and Vercel

- Vercel: `NEXT_PUBLIC_REVENUECAT_IOS_KEY` (and the Android key), `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_WEBHOOK_HMAC_SECRET`, `TRIAL_CLAIM_KEY_SECRET` (QA-59, until set the trial key falls back to plain SHA-256), `SMS_REQUIRE_DEVICE_HEADER=1`.
- **14 days' notice before paid features go on sale:** the Terms promised it and the new Terms 7A repeats it. Send the in-app notice and email at least 14 days before Pro is promoted (S5c V-6).
- Owner reads the new Terms 7A refund sentence ("if Apple says no we add 3 months", annual only, by support) and confirms support will really do it; it is the council wording from S5c P-7 but no code builds it.
- Egypt: a lawyer's read of the trial, refund and Sparks wording is still recommended (S5c section 11); a new Consumer Protection Law is expected to replace the e-commerce law.
- Supabase: Send Email hook (done 2026-11-19), OTP length 6.
