# Buddget Marketing Brief (source of truth)

Version 1.1, 2026-11-15 (owner decisions 1 to 5 incorporated; see section 13). Built from an interview with the owner, the repo (`CLAUDE_CONTEXT.md`, `docs/MASTER_PLAN_LAUNCH.md`, `docs/launch/*`, `docs/QA_ROUND_6.md`, site content), read-only aggregates from the live database, and competitor store pages read on 2026-11-15.

**Rule for every marketing decision:** if a statement is not marked VERIFIED here, it is not a claim. Update this file before changing a claim, never after.

Evidence tags used below:
- **VERIFIED**: read in a primary source (code, live DB, a store page) on the date above.
- **OWNER BELIEF**: stated by the owner, not tested.
- **ASSUMPTION**: my working assumption, needs validation.
- **UNKNOWN**: could not be checked. See section 12.
- **CONFIRMED DECISION**: made by the owner. Binding until the owner changes it.
- **RECOMMENDATION**: my proposal, not yet approved.
- **NEEDS VERIFICATION**: depends on a check nobody has done; do not treat as true.

---

## 1. What Buddget is

A budgeting app for iPhone and Android (plus a web app) in Arabic and English. It tracks income, spending, accounts, subscriptions, debts and installments, goals and savings, and shows what is left to spend until payday. Bank-text (SMS) reading is optional. Buddgy is the in-app assistant.

**The problem (OWNER BELIEF, not yet validated by research):** people who earn money cannot see their whole financial picture. The issue is fragmentation and uncertainty, not overspending. They check a bank balance, scroll SMS, check cash, subtract bills in their head, and try notes or spreadsheets. They decide from the bank balance, not from what is left after upcoming obligations. Manual budgets are abandoned because tracking is exhausting. Some are disciplined but lack the right tool.

**The aspiration:** financial clarity and control, felt as "managing money can be easier".

## 2. Audience

- **Markets:** Egypt (primary, first to win), Saudi Arabia and UAE (secondary, validate in Egypt first).
- **Age:** 20 to 40; primary 23 to 35.
- **Who:** salaried employees and corporate professionals (core). Freelancers, self-employed and small business owners with irregular or multiple incomes (secondary). Ordinary working people, not high earners or finance enthusiasts.
- **Status:** all of this is OWNER BELIEF. No research or audience data exists yet. Interviews with 8 to 10 people in Egypt are recommended before the reveal phase.

## 3. Markets and what we may say per market

| Market | Positioning | Bank-text capture |
|---|---|---|
| Egypt | Primary. Arabic and English; EGP default. | Partly verified (see section 4). Verify bank by bank before naming banks or giving accuracy. |
| Saudi Arabia | Arabic and English; manual and voice entry as the conservative positioning. | UNVERIFIED. One tester; no code-tier pattern in the November review; do not claim. |
| UAE | Arabic and English; manual and voice entry as the conservative positioning. | UNVERIFIED. No real messages in the data; patterns come from third-party fixtures. Do not claim. |

### 3a. Arabic language support vs full RTL (decision 1)

**CONFIRMED DECISION:** full Arabic RTL is part of the product direction. **Do not advertise it as a current capability** until the tester build is verified to be RTL.

| Level | State | Evidence |
|---|---|---|
| Arabic language (translated copy, Arabic font, text alignment, Latin digits, Arabic plurals) | **VERIFIED in code** | `ar.ts` dictionary, IBM Plex Sans Arabic via `data-locale`, `ar-EG-u-nu-latn` formatting, `arPlural.ts` |
| Full RTL interface (mirrored navigation, layouts, forms, charts, numbers, mixed text) | **NOT PRESENT in the app code** | `src/app/(app)/layout.tsx` hardcodes `<html dir="ltr">`; `docs/DESIGN_SYSTEM.md` says "UI layout stays LTR throughout; `dir` on `<html>` is always `ltr`" |
| Public website in Arabic | **RTL** (`dir="rtl"` on the Arabic site layout) | `src/app/(site-ar)/layout.tsx` |

Groundwork exists (85 `rtl:` class uses and many logical-property utilities), so RTL is a plausible build, but it reverses a standing design-system rule and needs a design decision, mirrored icons and charts, and a mixed Arabic/English text pass. Because `dir` is hardcoded, every build from this code is LTR; a tester build cannot be RTL unless it predates this code (NEEDS VERIFICATION on the device).

**Allowed wording now:** "Arabic and English". **Not allowed:** "full RTL", "right-to-left interface", "built for Arabic layout". The website being RTL must not be used as proof of the app.

Three levels of readiness, never conflated: (1) implemented in code, (2) bank coverage verified by real testing, (3) reliable enough to promise. **Today nothing is at level 3 for any market.**

## 4. Product status register (what testers can actually use)

Checked 2026-11-15. Live flags: only `onboarding_v1` (enabled, 10% rollout since 2026-10-23). Billing switch is off. 47 accounts; 10 registered devices (8 iPhone, 2 Android). All 47 hold a free Plus preview to 2027-02-01.

**Tester build is UNKNOWN.** The database records no app version. Repo is at iOS 1.1.0 (141), Android 1.1.0 (175). QA6 listed TestFlight 137 and an Android debug-signed APK vc171. Crash rows show older builds. Native builds bake the web layer in at build time.

| Capability | Status | Evidence |
|---|---|---|
| Accounts, expenses, income | Live | No flag; 69 payment methods (22 users), 33 income sources (21 users) |
| Daily number | UNKNOWN on tester build | Code exists, no flag |
| Bank-text capture | Partial | 11 users. Android reads directly; iPhone needs a one-time Shortcuts automation; web: none |
| Voice entry | Live in code; usage UNKNOWN | Dialect handling UNVERIFIED |
| Receipt scanning | Live, barely used | 2 receipts, 2 users |
| Subscriptions, debts, goals | Live, lightly used | Debts 28 (11 users), goals 17 (4), subscriptions 7 (3) |
| Investments (gold, crypto, stock, property) | Implemented, unproven | 0 holdings in the database |
| Adaptive budget builder | Partial | Question flow reads known data and remembered answers; "engine first, AI second". 36 plans (16 users); AI-made 15 (10 drafts, 5 ready); budget page redesign status UNKNOWN |
| Buddgy chat | Live, narrow | Edits via confirm cards; no what-if tool found; memories for 1 user |
| Onboarding | Behind flag | 10% rollout; native path |
| Paid plan, Sparks, founders club | Disabled | Billing off; no public pricing |

### Egypt SMS coverage (from the 2026-11-14 review of 952 messages; may have moved since)

CIB strong (133 messages, mostly code-matched); NBE account-style code-matched, NBE card-style transfers AI only; HSBC 60; QNB 3; Vodafone Cash mostly promos. Never seen: Banque Misr, AAIB, Alex Bank, Orange Cash, e& Cash, Fawry, valU, Telda, Halan. Accuracy beyond direction and type cannot be scored (digits masked, raw bodies deleted). Native Kotlin and Swift capture is unverified on a device.

## 5. Competitors

Everything below is what each developer's store page states (read 2026-11-15). I installed none of them. "Not stated" is not "absent".

| Competitor | Arabic | Bank capture | Price shown (US store) | Rating |
|---|---|---|---|---|
| [Money Lover](https://apps.apple.com/app/id486312413) | In language list; RTL not stated | Paid Linked Wallet; banks named are in Southeast Asia | Lifetime $19.99; Linked Wallet $2.99/mo | 4.6 (2.3K) |
| [Wallet by BudgetBakers](https://apps.apple.com/us/app/id1032467659) | In language list; RTL not stated | Premium, "4,000 banks"; Egypt/Gulf not named | $5.99 to $14.99, $29.99; Lifetime $49.99 | 4.6 (5.9K) |
| [Masrofi](https://apps.apple.com/app/id1467616866) | RTL | SMS import, Saudi banks named, "190+ banks and wallets in 22 countries" (claim) | $4.99/mo, $39.99/yr | 4.0 (2) |
| [Masareef](https://apps.apple.com/app/id6778533443) | RTL | SMS capture, Premium only | $9.99 | none |
| [Masareefy](https://apps.apple.com/app/id6779322746) | RTL; Egyptian Arabic voice | Bank texts auto-log; Vodafone Cash, Telda, InstaPay named | $2.99/mo family, $14.99 pro | 5.0 (2) |
| [TrackNest](https://apps.apple.com/us/app/id6759209389) | Conflicting | iOS Shortcut; says it never accesses your bank | $3.99/mo, $34.99/yr | 5.0 (4) |

Not verified: YNAB, Money Manager, Monefy (no Arabic found; prices from third parties only), Pockito (page did not load), Monee.ae (404), Buxfer (vendor claim). Malaa is an investment app, not a rival. Indirect competitors (bank apps, spreadsheets, notes, mental maths) are ASSUMPTION; no bank app was tested. UAE competitors are largely unresearched. User reviews were not mined.

Notable: Masrofi (strongest in Saudi) states an on-device chat assistant, net worth, Zakat, savings circles (Jameya), "zero cloud uploads" and "Data Not Collected". Buddget sends bank-text content to the server for parsing, so a blanket privacy claim is risky.

## 6. Differentiation: honest verdict

**No defensible advantage is proven yet.** SMS capture, safe-to-spend, Arabic RTL and a regional focus are **table stakes** in this market, not differentiators.

Candidate differentiators (OWNER BELIEF, untested, not for marketing as claims):
1. A more complete financial picture in one place (strong in code; competitors' pages do not state debts, investments and goals together; unverified).
2. An adaptive budget builder (partial; rules-first, AI second).
3. Budgeting as conversation and scenario exploration (**planned only; no what-if tool exists**).
4. Accessibility for ordinary people (no evidence).

Possible gaps (hypotheses): trust and track record (rivals have 0 to 5 ratings); the whole picture plus guidance; UAE (unresearched).

**Before claiming anything:** run a hands-on benchmark (same 5 tasks across 4 apps, time and taps), 8 to 10 user interviews in Egypt, and the bank-by-bank SMS check.

## 7. Brand

**Personality:** a smart, approachable financial companion. Modern, clear, confident, practical, reassuring. Smart but not arrogant; friendly but not childish; confident but not aggressive; reassuring but not boring; modern but not trend-obsessed; realistic; encouraging without promising outcomes.

### 7a. Brand colour (decision 2)

**CONFIRMED DECISION:** teal is the primary brand colour. Red is used selectively for alerts, negative balances and spending warnings.

**VERIFIED: this already matches the shipped brand.** `globals.css` defines the primary as teal (`#0D8578` fill, `#12B0A0` bright, `#E3F6F3` soft); the PWA manifest uses `#12B0A0` and `#0A100F`; the press kit uses teal and "Ink" `#0A100F` and "Mist" `#F4F7F6`; the logo handoff specifies brand teal `#12B0A0` with deep `#0D8578`; Buddgy's brand tone uses the bright teal and `danger` uses red `#BE343A` (negative/destructive only). `CLAUDE_CONTEXT.md` still lists red `#E50914` as the brand colour; that is **stale documentation, not the brand**. No hex `#E50914` remains in `src` or `public`. No asset change is needed; update the doc.

Reference tokens: teal fill `#0D8578`, bright `#12B0A0`, ink `#0A100F`, mist `#F4F7F6`, alert red `#BE343A`, income green `#0F7635`, investment gold `#896617` (founders gold is for founders only). Marketing assets must use these, not new hexes. The logo set is in `design/buddget-logo` (read its README before producing assets); the Buddgy character is `src/components/ai/BuddgyIcon.tsx` (16 moods, outline style, tone variables).

**Idea:** *Month-end should not be a surprise.* The enemy is the guessing, not the user. Candidate line (not approved): "Money is complicated enough. Buddget makes it easier to understand and manage." "Easier" is a promise: theme, not a measurable claim.

**The user should feel:** (1) "This understands my financial life." (2) "Managing my money doesn't have to be this complicated." (3) "I want to see what Buddget can do for me."

**Never (hard rules):**
- Judgmental, guilt or shame-based. Non-negotiable.
- Like a bank, accounting tool or corporate institution.
- A get-rich-quick scheme or investment guru.
- A generic budgeting app with recycled advice.
- Childish, over-cute, or dependent on Buddgy for entertainment.
- Fearmongering about debt, spending or failure.
- Out of touch with realities in Egypt and the Gulf.
- Over-promotional, constantly asking people to download.

**Cancel a post immediately if it:** (1) makes people feel stupid, irresponsible, poor or guilty; (2) uses fake statistics, fabricated testimonials, exaggerated promises or unsupported claims; (3) is generic, repetitive, culturally disconnected or obviously AI-made; (4) promises unrealistic outcomes or presents Buddget as solving what it cannot; (5) sacrifices identity to chase a trend.

**Buddgy:** a recognizable part of the brand, never the whole brand. The product must stay credible as a financial product. Buddgy exists in the app as a vector character with 16 moods. Humor when natural, emotional storytelling when it adds meaning, education when it gives real value.

**Voice rules:** calm; plain words; no exclamation marks outside celebration; errors say what did not happen, then what to do (per `docs/COPY_GLOSSARY.md`). Buddgy gives guidance, not financial advice.

## 8. Launch gates, stages and timeline

No public date is confirmed. **Do not announce a date until gates 1 to 7 are green and store approvals are in.**

| Gate | Status (2026-11-15) |
|---|---|
| 1. Core product | Amber (QA6: 0 P0; live sweep with real data and real-device paths not run; S7 pending) |
| 2. Budget builder | Unverified (three user types untested; redesign status unknown) |
| 3. Data reliability | Amber (November review found P0 bugs; batch 1 fixed; batch 2 status not read) |
| 4. Market readiness | Amber Egypt, Red Gulf. **The app is LTR** (`dir="ltr"` hardcoded); full RTL is now a confirmed product direction but not built; six of ten SMS users default to Cairo time zone |
| 5. Bank SMS | Red (no accuracy table; Saudi one tester; UAE none; Play `RECEIVE_SMS` declaration open) |
| 6. Platform | Red (Android debug-signed only; release build never run; native code unverified on device) |
| 7. Business | Amber (policy, terms, deletion, analytics exist; screenshots, store copy, handles, assets, legal reconciliation open) |

**Stages:** Internal alpha (now, effectively a small closed beta of 47 accounts). Closed beta exits on: Egypt bank accuracy table published; 40% of testers who enable SMS see an automatic transaction within 10 minutes; store declarations approved; three budget-builder user types tested. Public launch: Egypt first; Saudi and UAE as manual and voice until their tables exist.

**Estimate (not measured velocity):** about 8 to 12 weeks from 2026-11-15, i.e. late January to mid-February 2027 at the earliest. Drivers: Play SMS approval, Play's closed-test rule for new developer accounts (rule and account type UNKNOWN), release-signed Android build, device tests. Later if any of these fail. Launch free, paid plan live but unpromoted, per the existing plan.

## 9. Marketing strategy

**Principle:** awareness first. Problem before product. Soft calls to action (about 1 in 5 posts), never "download now".

| # | Phase | Window (relative to launch L) | Objective | Reveals app? |
|---|---|---|---|---|
| 1 | Problem awareness | L-10 to L-8 | Recognition and shares | No |
| 2 | Curiosity | L-8 to L-6 | Follows, curiosity | No |
| 3 | Brand identity | L-6 to L-4 | Make Buddget and Buddgy known | Name only |
| 4 | Product reveal | L-4 to L-2 | Show what it really does, real screens | Yes |
| 5 | Pre-launch | L-2 to L | Beta-list growth, anticipation | Yes |
| 6 | Launch | L to L+2 | Downloads and registrations | Yes |
| 7 | Post-launch | L+2 to L+10 | Trust, activation, referral | Yes |

Windows are placeholders until L is set. Phases 1 and 2 can start now (no app, no feature, no bank, no date, no price). Phase 4 needs gates 1, 2 and real store-build screens. Phase 5 and any date need gates 5 and 6.

**Content pillars:** (1) payday reality; (2) the daily number; (3) zero typing (only after capture is verified); (4) trust and privacy (claims limited to what is true); (5) Buddgy; (6) built in the open.

**Platforms:** Instagram (brand home: Reels, carousels, Stories, teasers, community) and TikTok (discovery: relatable moments, short stories, Buddgy scenes). Later: Facebook, LinkedIn; X low priority. Do not publish identical content: adapt hook, length, captions and tone per platform. Handle ownership and availability is UNVERIFIED; reserve handles on all platforms and fill `SOCIAL_LINKS` in `src/lib/site/config.ts`.

**Minimal-tier cadence:** Instagram 2 Reels, 2 carousels or posts, 3 to 4 Stories a week; TikTok 3 videos a week (2 adapted, 1 native). Judge results against your own baseline (saves, shares, DMs, profile visits, follows, link clicks; completion, shares, recognition comments).

**Content language (decision 3, CONFIRMED):**

| Market | Primary | Secondary |
|---|---|---|
| Egypt | Egyptian Arabic | English |
| Saudi Arabia | Natural Saudi Arabic | English |
| UAE | Accessible Gulf-friendly Arabic | English |

Modern Standard Arabic where formal or educational. No literal translations; each market's content is written for that market. **RECOMMENDATION:** a native reviewer per market (Egyptian, Saudi, Emirati or Gulf) before posting, because one reviewer cannot cover all three dialects; start Egypt-first, and run Saudi and UAE content only at low volume until Egypt works. Note the in-app copy is simple MSA by design (`docs/COPY_GLOSSARY.md`), so social tone will be more colloquial than the app; keep the same calm, no-shame voice.

**Accounts structure (RECOMMENDATION, not decided):** one account per platform, Egyptian Arabic first, rather than three country accounts, until Egypt proves out. NEEDS owner decision.

## 10. Budget and production

No budget set. Lean, organic first. Costs below are planning estimates, not quotes.

| | Minimal | Moderate | Growth |
|---|---|---|---|
| Monthly (USD) | about $0 to $150 | about $300 to $800 | about $1,500 to $3,000+ |
| Buys | tools, a few hours of native Arabic review | part-time editor or designer, regular Arabic review, small test fund | editor or motion retainer, creator pilot, larger test fund |
| Production / paid split | 85 to 100 / 0 to 15 | 65 / 35 | 55 / 45 |
| Owner time per week | about 5 to 7 h | about 4 to 5 h | about 3 to 4 h |

Start at Minimal. Move up when a message has proven itself, the reveal needs store-build screens, and launch is within about 6 weeks.

**Production kit (build once):** Buddgy character kit; one brand colour decision; carousel, Story and Reel templates in Arabic and English; claims checklist; content calendar; approval flow (AI draft, claims check, owner approval, native Arabic review). AI may draft scripts, concepts and Buddgy scenes. It must never fake app screens, features, statistics or testimonials.

**Paid experiments:** only behind content already proven organically; test hooks and angles, not features; fixed caps and stop rules; no bought followers or installs pre-launch. Finance-advertising rules on Meta and TikTok are UNVERIFIED; check before any paid test.

**Attribution gap:** site analytics are cookieless with no source, so sign-ups cannot be tied to a platform. Options (need a code change and owner approval): per-platform landing links, or a "how did you hear" field on the beta form.

## 11. Claims register

**May describe now, as mechanisms not guarantees** (and only for what is in the tester build):
- Tracks expenses and income across cash, bank accounts and wallets.
- Tracks subscriptions, debts and goals.
- Buddgy answers questions about your own numbers; changes show on a card you confirm.
- Arabic and English.
- Delete your account and data inside the app.
- Bank-text reading is optional and off until you turn it on (Android and iPhone setups differ).

**Only after verification:** any named bank; any accuracy figure; the "85% from bank texts" site figure (the site says 15 beta users, the launch plan says 45 to 47; unreconciled); Saudi or UAE capture; voice in any dialect; receipt-scan reliability; "AI builds your budget"; setup time; offline use; privacy comparisons.

**Do not claim:** investments tracking; what-if scenarios; Plus, pricing, Sparks or founders club; RTL layout; "only app that"; testimonials or reviews (none are real yet); "no ads"; any launch date.

**Pre-post checklist:** no bank names or coverage, no price or plan, no date, no "only", no shame, no fear, no unverified number, no fake screen, native Arabic review done.

## 12. Open items and who owns them

| # | Item | Owner |
|---|---|---|
| 1 | Latest TestFlight and Drive builds; confirm 141 / 175 uploaded | Owner |
| 2 | Budget builder: is the redesign in the tester build? | Owner |
| 3 | Raise onboarding above 10% before beta? | Owner |
| 4 | Web parity for voice, receipts, Buddgy | Owner / dev |
| 5 | Device test of SMS, voice, receipts on iOS and Android | Owner / dev |
| 6 | Does investments work end to end? | Owner / dev |
| 7 | Play `RECEIVE_SMS` declaration submitted? Play closed-test rule and account type | Owner |
| 8 | **Name conflict check.** An App Store finance app already uses the name **"Buddget: Expense Tracker"** (see 12a). Handles for Buddget and Buddgy on Instagram, TikTok, Facebook, LinkedIn, X: NOT checked. Trademark searches in Egypt, Saudi Arabia, UAE: NOT done. | Owner, with a qualified trademark professional |
| 9 | Brand colour: **resolved** (teal; matches shipped brand). Update stale `CLAUDE_CONTEXT.md` and keep marketing assets on the tokens in 7a. | Done / dev |
| 10 | RTL: direction confirmed; build and design decision not made; verify the tester build on device before any RTL wording | Owner / dev |
| 11 | Beta numbers: reconcile 15 vs 45 to 47 users and the 85% figure | Owner |
| 12 | Content language: **decided** (3). Open: a native reviewer per market; one account vs per-country accounts | Owner |
| 13 | Marketing budget: **not fixed**; lean and organic first. Production: owner directs and approves, AI assists, outsource editing and motion when needed | Owner |
| 14 | Launch date | Unset; set only after gates are green |
| 15 | Competitor hands-on benchmark and user interviews | Owner, with tooling support |
| 16 | Attribution: per-platform links or beta-form field | Owner approval, then dev |

### 12a. Name and handle risk (decision 4)

**NEEDS VERIFICATION. No legal conclusion is drawn here.**

- **Found (VERIFIED on the store page, 2026-11-15):** an iOS finance app called "Buddget: Expense Tracker", seller "Samuel Pinheiro Junior", copyright "© 2025 Buddget Inc.", English and Portuguese, free with in-app purchases, earliest version-history entry 03/26/2025, version 1.6.1. It is listed in the **Egypt storefront** with Egyptian-pound purchase prices. Its description is a general personal-finance pitch similar to ours, with no ratings shown.
- **What this does not tell us:** whether "Buddget Inc." is a registered company, whether the name is a registered trademark anywhere, whether it is used in Egypt, Saudi Arabia or the UAE beyond the storefront listing, or who has prior rights. It is a risk to investigate, not a finding of infringement.
- **Why it matters for marketing:** a same-name finance app in the same store, category and country can cause search confusion, handle conflicts and App Store naming collisions, and can undermine a "Buddget" brand build. Resolve it before spending on a brand campaign or announcing handles.
- **Checks to run (owner, with a trademark professional):** (1) handle availability and ownership for Buddget and Buddgy on Instagram, TikTok, Facebook, LinkedIn, X, YouTube; (2) trademark searches in the Egyptian, Saudi and UAE registries and WIPO; (3) the App Store name situation for our own listing; (4) a conflict review with counsel. I did not search any trademark registry, and I can't check social handles from here.
- **Search attempt, 2026-11-15 (all INCONCLUSIVE):**
  - Social handles: none of 17 profile URLs (`buddget`, `buddgy`, `buddget.app`, `getbuddget`, `buddgetapp` across Instagram, TikTok, Facebook, LinkedIn, X, YouTube) returned a real profile. Instagram was rate-limited (429), TikTok returned a generic page, Facebook a login wall (one page named "Buddget" may exist at `/buddgetapp`, nothing else visible), LinkedIn 403, X 402, YouTube 404 for `@buddget` and `@buddgy` (a 404 suggests but does not prove availability). Logged-out reads cannot establish availability; the only reliable test is trying to create the account while logged in.
  - Domains: `buddget.app` is ours (live, Arabic landing page). `buddget.com` redirects to a different host that I did not follow (unverified). `buddgy.com` returned 503; `buddgy.app` did not resolve from this environment.
  - Trademark: web searches found no record of "Buddget" or "Buddgy" as marks, but these searches do not cover national registers and are **not a clearance**. WIPO's Global Brand Database covers Madrid-system marks and is listed by the UAE portal as a search tool. A law-firm page says Egypt has no public trademark database and Saudi Arabia may not be covered by WIPO's database (both possibly out of date), so Egypt and Saudi Arabia likely need the national offices or a local attorney. Nothing was searched in the Egyptian, Saudi (SAIP) or UAE registers.
- **Interim rule (superseded 2026-11-16):** the owner decided to use the Buddget name from the first post. Owner states the name is not trademarked; this is the owner's own check, not verified here, and does not address prior unregistered use or the existing App Store listing. The trademark and handle checks above remain required as a precaution and must not be skipped.

## 13. Decisions log

- Egypt is the home market; Saudi and UAE secondary. (Owner)
- Saudi and UAE positioned as manual and voice; SMS unverified. (Owner)
- Instagram and TikTok first; Facebook and LinkedIn later; X low. (Owner)
- Awareness first, no aggressive advertising, no date until gates are met. (Owner)
- Lean, organic start; small controlled paid tests later. (Owner)
- No shame, ever. (Owner, non-negotiable)
- Competitive features (SMS, safe-to-spend, Arabic) treated as table stakes. (Owner)
- Differentiators stay hypotheses until tested. (Owner)
- Full Arabic RTL is part of the product direction; not advertised until verified in the tester build; Arabic language support and RTL are distinct. (Owner, 2026-11-15)
- Primary brand colour is teal; red only for alerts, negative balances, spending warnings. (Owner, 2026-11-15; matches shipped brand)
- Content language: Egyptian Arabic (Egypt), natural Saudi Arabic (Saudi), accessible Gulf-friendly Arabic (UAE); English secondary; MSA for formal or educational content; no literal translations. (Owner, 2026-11-15)
- Handles and trademarks must be verified in Egypt, Saudi Arabia and UAE before assumed available; no legal conclusions without verification. (Owner, 2026-11-15)
- Positioning approved: "Buddget is a personal finance companion that helps people understand, organize, and take control of their money." Core message: managing money doesn't have to be complicated; a clearer picture and more informed decisions. (Owner, 2026-11-16)
- Audience segments approved as hypotheses, not validated demographics. Priorities: Egypt, then Saudi Arabia, then UAE. (Owner, 2026-11-16)
- Content pillars and mix approved: relatable situations, education, entertainment and shareability, brand storytelling, Buddgy-led content, demonstrations, behind-the-scenes and building in public, promotional content nearer launch. Early stages prioritise awareness, relatability, curiosity and engagement over promotion. (Owner, 2026-11-16)
- Creative direction conditionally approved: hybrid accepted in principle; owner must approve the concrete execution (see `STAGE2_CAMPAIGN_CONCEPT.md`). Teal primary, red only for warnings; existing logo and Buddgy preserved. (Owner, 2026-11-16)
- Use the Buddget name from the first post, including teasers; trademark and handle checks continue as a precaution and do not block the campaign. (Owner, 2026-11-16)
- Ramadan: seasonal content only where natural; not the brand identity; no launch date based on Ramadan; readiness gates set the date. (Owner, 2026-11-16)
- No on-camera dependency. Build on motion graphics, screen recordings, voice-over, typography, Buddgy animation and AI-assisted production; occasional founder appearances possible later. (Owner, 2026-11-16)
- Creative direction locked 2026-11-16 (see `STAGE2_APPROVAL.md`): three-act concept "What's actually left?" (The Question, The Picture, The Answer); taglines "What's actually left?", "One month. One picture.", "Here's what's left.", "Money, in plain words."; five devices; Buddgy rules with the helmet joke removed; five-stage name sequence; reviewer sourcing and budget controls. (Owner)
- Production approved 2026-11-16: relative-phase calendar and Batch 1 (five posts) with Instagram and TikTok adaptations; native Egyptian review before final approval; batches of five reviewed before the next. Buddgy's gender wording remains open. (Owner)
- Buddgy gender wording FINAL (2026-11-16): masculine grammatical wording where Arabic requires it, consistently; prefer the name; no gender as a marketing message; character and design unchanged. (Owner)
- Copy craft (2026-11-16): Buddget speaks as "we" rather than "you" in Arabic copy; Batch 1 rewritten after a self-critique (cashier listicle cut, repeated insight removed, Buddgy only in post 3). Reviewer trial package prepared; reviewer NOT yet contacted or hired. Final campaign package: `stage2/campaign-package.html`.
- No fixed budget; lean organic Instagram and TikTok; AI-assisted production with owner approval; outsource editing and motion when needed; paid ads only as controlled experiments after promising content. (Owner, 2026-11-15)

## 14. Sources

Repo: `CLAUDE_CONTEXT.md`, `docs/MASTER_PLAN_LAUNCH.md`, `docs/launch/S2b-sms-review.md`, `docs/launch/S6-build.md`, `docs/QA_ROUND_6.md`, `docs/ONBOARDING_PLAN.md`, `docs/BUDGET_V2_PLAN.md`, `docs/COPY_GLOSSARY.md`, `docs/SMS_PATTERN_RESEARCH.md`, `src/lib/site/content/en.ts`, `src/lib/sms/patterns/*`, `src/lib/budget/flow/*`, `src/lib/buddgy/tools/*`. Live DB (project `ydihurtbcnoflhormgzi`): `feature_flags`, `platform_settings`, aggregate counts. Competitor store pages: links in section 5.
