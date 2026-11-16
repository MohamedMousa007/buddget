# Buddget Stage 1: Audit and Strategic Foundation

2026-11-16. For owner approval. Extends `BUDDGET_MARKETING_BRIEF.md` (v1.1), which remains the source of truth for facts and claims. Evidence tags as in the brief: VERIFIED, OWNER BELIEF, ASSUMPTION, UNKNOWN, CONFIRMED DECISION, RECOMMENDATION, NEEDS VERIFICATION.

## 1. Audit: what limits what we can say

### 1.1 Your scope list against verified readiness

| Scope item in the master prompt | Claimable now? | Why |
|---|---|---|
| Income and payday tracking | Yes (mechanism) | Live, no flag; 21 users with income sources |
| Expense tracking | Yes | Live, no flag |
| Multiple financial accounts | Yes | Live; 22 users with payment methods |
| Bank SMS capture | **Mechanism only** | Optional; Egypt partly verified (CIB strong); Saudi one tester; UAE none; Android release build never run on device; Play declaration open |
| Subscriptions, debts, instalments, goals | Yes (mechanism), lightly proven | Live; used by 3, 11, 4 users |
| Investments | **No** | Implemented, but zero holdings in the database; no tester has used it |
| Budget planning | **Partial** | Question flow is live and used (16 users); AI-made plans: 10 of 15 still drafts; redesign status unknown |
| AI guidance (Buddgy) | Narrow | Answers about your numbers; changes via confirm card; no what-if tool; memory used by 1 user |
| Voice and receipt entry | **Cautious** | Live in code; receipt used twice; dialect handling unverified |
| Paid plan, Sparks, founders club | **No** | Switched off; no public pricing |

### 1.2 Things that can break a campaign

1. **Name conflict (NEEDS VERIFICATION).** An App Store finance app named "Buddget: Expense Tracker" (seller Samuel Pinheiro Junior, "© 2025 Buddget Inc.") is live, including in the Egypt storefront. Handles and trademarks are unchecked. No legal conclusion. Until cleared: name-neutral teasers, no handle push, no logo lockup.
2. **RTL.** The app is `dir="ltr"`; only Arabic language support is claimable. Full RTL is a product direction, not a capability.
3. **Tester build unknown.** The database records no app version. Marketing visuals must come from a verified build.
4. **Gulf SMS.** Saudi and UAE are manual and voice only in all marketing.
5. **No launch date.** Earliest realistic window is late January to mid-February 2027, which collides with Ramadan 2027 (see 3.6). Do not announce a date.
6. **Beta numbers conflict.** The site says 15 beta users and 85% from texts; the launch plan says 45 to 47 users. No statistic is published until reconciled.
7. **Table-stakes features.** SMS, safe-to-spend and Arabic are not differentiators.
8. **Face or voice of the brand.** Unanswered: see section 6.

### 1.3 Where your master prompt conflicts with the evidence (challenges)

- "Entire financial situation" is the vision, not today's product. Today the verifiable promise is "see where you stand this month and what is left to spend". Sell the vision as direction, never as a current guarantee.
- "Separate localized content for three markets" is too heavy for a founder with AI help. Recommendation: Egypt carries 85 to 90% of effort; Saudi and UAE get a thin layer (a few Reels, a few Stories) until Egypt shows signal.
- "Premium and distinctive visuals" plus "no generic AI look" is the hard part of a lean plan. The brand has real assets (teal tokens, a Buddgy vector with 16 moods, a logo set). Use those first; do not generate new character art.
- "Build recognition before conversion" is right, but with a name conflict open it carries a risk: recognition spent on a name you may not keep.

## 2. Strategic foundation

### 2.1 Positioning (RECOMMENDATION)

**Category frame:** a personal money companion, not an expense tracker.

**Positioning statement:** For working people in Egypt and the Gulf whose money lives in several places, Buddget is the money companion that puts your month in one picture, so you know where you stand and what is left to spend, without the spreadsheet.

Proof points allowed today: accounts, bills, subscriptions, debts and goals in one app; a daily number from your income, bills and payday; Buddgy answers from your own numbers and asks before changing anything; Arabic and English; delete your data in the app.

No comparative claim. We are not "better than", "first", "only", or "smarter than" any app.

### 2.2 Core message and brand line

- **Core message:** *You don't need to be a money person. You need one clear picture.*
- **Brand idea (from the brief):** *Month-end should not be a surprise.* Enemy: the guessing, not the user.
- **Line candidates already in the product (VERIFIED):** the PWA description "Your money, finally makes sense." and the site hero "What can you spend today?". Prefer extending existing lines to inventing new ones.
- **Tagline candidates (Stage 2):** options built around clarity, "one picture", and the daily number. None approved.

### 2.3 Value proposition

- **Rational:** one place for accounts, bills, subscriptions, debts, goals and income; a daily number that accounts for what is already spoken for; capture that reduces typing where it works (Egypt, bank-dependent); an assistant that answers from your numbers.
- **Emotional:** calm, control, being understood, less mental load.
- **Not promised:** savings amounts, outcomes, "no effort", accuracy, coverage.

### 2.4 Audience segments (all OWNER BELIEF, to validate with 8 to 10 Egyptian interviews)

| Segment | Situation | Pain | Angle | Watch-out |
|---|---|---|---|---|
| A. Salaried professional (core) | Fixed payday, bank balance as the decision tool | By the 3rd you are guessing; bills and instalments not in the balance | Daily number, payday rhythm | Do not imply they are bad with money |
| B. Freelancer and multi-income | Irregular income, several sources | No stable monthly picture | One picture of everything coming in | The product asks "steady or varies"; verify depth before leaning on this |
| C. Small business owner | Personal and business money blur | Cannot tell what is theirs | Separate what is mine | The product is personal finance; do not promise business accounting |
| D. Household contributor | Family contributions, instalments, subscriptions | Commitments scattered | Upcoming commitments in one place | Avoid family-pressure framing |

### 2.5 Pain points to dramatise (the seven in the master prompt)

Where the salary went; checking the balance before buying; forgetting subscriptions; several instalments; saving without knowing what is free; money in different accounts; not knowing what is safe to spend. Each becomes a recognisable situation, never a flaw in the person.

### 2.6 Emotional vs rational messaging

| Stage | Lead with | Support with |
|---|---|---|
| Problem awareness | Emotional: recognition ("that's me") | One rational insight (the balance is not what is left) |
| Curiosity | Emotional: intrigue about one number | None |
| Brand | Values and personality | Founder and builder story |
| Reveal | Rational: real screens | Emotion: relief and ease |
| Pre-launch, launch | Social proof (only real) and clarity | Clear next step |
| Post-launch | Education and community | Product updates |

### 2.7 Market strategies

| Market | Role | Language | Approach |
|---|---|---|---|
| Egypt | Win first | Egyptian Arabic primary; English secondary | Full content system; payday and instalment situations; Egyptian humour; native Egyptian reviewer |
| Saudi Arabia | Test | Natural Saudi Arabic; English secondary | Thin layer; manual and voice only; no SMS claims; native Saudi reviewer; own situations, not Egyptian ones translated |
| UAE | Test | Accessible Gulf-friendly Arabic; English secondary | Thin layer; same limits; many UAE residents read English, so English may carry more weight (ASSUMPTION) |

**Account structure (RECOMMENDATION):** one account per platform, Egypt-first, until Egypt proves out. Per-country accounts later.

### 2.8 Competitive positioning

Masrofi, Masareef, Masareefy and others already state SMS, safe-to-spend and Arabic RTL. These are entry tickets. Our public stance is about outcome and personality, not features-versus. Differentiation hypotheses (more of personal finance together; adaptive budget building; a guided experience; Buddgy) are **not marketing claims until tested**: the hands-on benchmark and interviews come first. One advantage nobody holds yet is trust and a track record: the regional rivals have 0 to 5 ratings. That is earned through honest content and real users, not claimed.

### 2.9 Voice

**We are:** plain, calm, specific, a little dry-humoured, never preachy. **We are not:** bank, guru, hype, cute, ashamed, afraid.

| Instead of | Say |
|---|---|
| "Stop wasting money!" | "Your salary didn't vanish. It got split across too many places." |
| "Are you financially irresponsible?" | "Checking the balance before every purchase is normal. There is an easier way to see what's left." |
| "Download now!" | "If this is you, we're building something for it." (only when allowed) |

Arabic lines are drafted natively in Stage 4 and reviewed by a native speaker per market. Illustrative Egyptian drafts (NOT reviewed): «المرتب نزل… وراح فين؟» and «رصيد البنك مش هو اللي فاضلك فعلًا.»

### 2.10 Content pillars and purpose

| Pillar | Purpose | Journey stage | Format |
|---|---|---|---|
| 1. Payday reality | Recognition and shares | Awareness | Relatable skits and carousels |
| 2. One picture | Make the whole-picture idea clear | Curiosity, brand | Typographic and graphic reels |
| 3. Small money lessons | Genuine value, trust | Awareness to consideration | Carousels and short explainers (MSA where formal) |
| 4. Meet Buddgy | Ownable character, warmth | Brand | Short character moments, sparing |
| 5. Built in the open | Credibility and testers | Brand to launch | Behind-the-scenes, honest progress |
| 6. See it work | Proof | Reveal onwards | Real screens only, one moment per video |

**Mix by phase (RECOMMENDATION, not a benchmark):** problem awareness about 50% relatable, 25% education, 25% brand; reveal about 40% demonstration, 30% education, 20% brand, 10% community; post-launch about 30% education, 25% demonstration, 25% community, 20% brand, with promotion capped at about 1 post in 5 throughout.

## 3. Recommended creative direction (preview; full concepts in Stage 2)

### 3.1 Three directions

1. **"The Number."** The daily number as the hero symbol: typography, graphic reveals, calm teal. Strong brand logic and existing site hero; abstract and slower to build emotion.
2. **"Month-End Moments."** Human vignettes with Egyptian humour (the salary morning, the balance-before-buying pause); no product shown. Most TikTok-native and relatable; people-led production is harder with AI alone.
3. **"Buddgy, the quiet friend."** Character-led mini stories. Ownable asset; risk of reading as childish and of production load, and the brand must not depend on it.

### 3.2 Recommendation

A **hybrid led by direction 2, anchored by direction 1, with Buddgy as a signature, not the host.** Recognition first (vignettes and the idea of one number), Buddgy appearing sparingly as a recurring "tag" so he becomes familiar before he becomes central. Teasers stay name-neutral until the name is cleared. Reasons: it matches the awareness-first goal, needs no verified product capability, fits a lean AI-assisted workflow (type, graphic and character scenes, not stunt cinematography), and keeps the no-shame rule easy to enforce.

### 3.3 Visual identity rules (VERIFIED assets, no redesign)

Teal primary (`#0D8578` fill, `#12B0A0` bright), ink `#0A100F`, mist `#F4F7F6`, alert red `#BE343A` only for alerts and negatives, income green `#0F7635`, gold only for founders. Buddgy as in `BuddgyIcon.tsx` (16 moods, outline). Logo from `design/buddget-logo`. No new characters, no stock finance imagery, no coin-and-chart clichés.

### 3.4 Creative guardrails

No shame, fear or guilt; no fake screens, stats or testimonials; no trend-chasing without a brand reason; no more than one idea per post; every post passes the claims checklist in the brief.

### 3.5 Hooks to avoid (generic)

"Stop doing this with your money", "3 apps you need", "you're losing money if…", countdown fear, "secret the banks don't want you to know".

### 3.6 Timing: Ramadan 2027 (NEEDS VERIFICATION)

Ramadan 2027 is expected to begin around early February 2027 (moon-sighting dependent; verify). A late-January to mid-February public launch would overlap it. That is high-relevance (planning, family spending, giving) and high-noise (heavy advertising), and a sensitive period for tone: no fear, no guilt, no pressure around giving. RECOMMENDATION: decide deliberately between launching just before, aiming for after, or using a low-key soft launch during. A calendar of salary days, Ramadan, Eid, school fees and sales events (such as White Friday) should drive phase timing in Stage 3. Do not chase impulse-spending hooks.

## 4. Stage 2 scope (next)

Campaign concept and platform idea; 4 to 6 tagline options with rationale; the teaser system; recurring formats (e.g. a weekly "salary day" format); Buddgy's role and rules; the visual system on the verified tokens; a recommendation, with challenges.

## 5. Approval needed

1. Positioning and message (2.1, 2.2).
2. Segments as hypotheses (2.4).
3. Pillars and mix (2.10).
4. Creative direction: the hybrid, or another (section 3).
5. Name-neutral until the trademark and handle checks finish.
6. How to treat Ramadan timing (3.6).

## 6. One open item (never answered earlier)

Will a human appear on camera (you, or a hired voice or actor), or will content be graphic, voice-over and Buddgy-led only? It decides how much of direction 2 can be produced.
