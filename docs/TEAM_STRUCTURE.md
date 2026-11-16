# Buddget Team Structure: Launch and GTM

Six roles, assigned below (council decision 2026-11-14, owner has final say). Shareable overview: https://claude.ai/artifact/AGUxPK6jNxD25ty9RfvSvw

| Role | Person | One-line scope |
|------|--------|----------------|
| R1 Owner | Mohamed Mousa | Product, design direction, release, merges, production, pricing, partnerships |
| R2 App Engineer + security reviewer | Ahmed Fadeel | Screens and flows; required reviewer on API, auth and DB PRs |
| R3 + R4 Platform, Quality and Support (shared role) | Kareem and Mohamed Salah | Identical scope: API, SMS parsing, AI, sync, admin, QA, release sign-off, support. Split by ticket; neither verifies their own PR; support on-call alternates weekly |
| R5 Growth, Data, Finance | Mohamed Salama (Gabal) | GTM strategy, analytics, Saudi market, accounting |
| R6 Brand, Content, Community | Osama | Social, campaign execution, EN/AR copy, community |

Everyone on the team builds with Claude Code ("vibe coders"), so every role, including marketing, can touch the repo, only inside its own paths. The git, PR and merge rules live in [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md); every person reads that file before their first ticket.

## 1. Does six people cover launch + GTM?

Yes for a first launch, if the Owner accepts three thin spots and outsources two things. Coverage by function (P = primary, B = backup, OUT = buy it, GAP = nobody owns it well):

| Function | R1 Owner | R2 App | R3 Platform | R4 QA | R5 Growth | R6 Brand |
|----------|----------|--------|-------------|-------|-----------|----------|
| Product strategy, roadmap, priorities | P | | | | | |
| Pricing and subscription setup (RevenueCat, store products) | P | | B | | B | |
| Screens and user flows | | P | | | | |
| Backend, data, SMS parsing, AI, sync | | | P | | | |
| DB migrations, native builds, store uploads, secrets | P | | | | | |
| Security and privacy review | P | | B | | | |
| Testing, device matrix, regression, release sign-off | | | | P | | |
| Crash/error monitoring review | | | B | P | | |
| Customer support, store reviews, feedback loop | | | | P | B | |
| App Store / Play listing, ASO | | | | | P | B |
| Website, SEO, landing pages | | | | | P | B |
| Analytics, funnels, dashboards | B | | B | | P | |
| Paid acquisition, referral, waitlist, email lifecycle | | | | | P | |
| Partnerships, influencers, PR | B | | | | P | B |
| Social media, video, community | | | | | B | P |
| UX copy, Arabic, help center, email copy | | | | | | P |
| Visual design, brand, store/social creatives | | B | | | | P |
| Design-system conformance | | P | | B | | B |
| Legal, company, tax, store developer accounts | P (with OUT) | | | | | |
| Bank/regulatory/financial-data compliance | P (with OUT) | | B | | | |

**Thin spots (accept or hire):**
1. **No dedicated designer.** R6 covers brand and creatives; R2 covers in-app UI inside the existing design system. A freelance designer for launch assets is the cheapest fix.
2. **No data analyst.** R5 owns funnels with whatever analytics are in the app; fine until paid acquisition scales.
3. **The Owner is a single point of failure** for migrations, native builds, pricing, legal and merges. Mitigation: runbooks in `scripts/` and a written "how to ship" file; see TEAM_WORKFLOW section 9.

**Buy, do not staff:** a lawyer (privacy policy, terms, financial-data and SMS-permission compliance) and an accountant (company, tax, store payouts). Check the Google Play SMS-permission policy and Apple review rules against the app's SMS features before the launch date (see `docs/GOOGLE_PLAY_SUBMISSION.md` and `docs/APP_STORE_SUBMISSION.md`); a rejection here moves the whole launch.

## 2. Role definitions

Common to every role: one Linear ticket per piece of work, branch and PR per ticket, no edits outside your paths, "stop and ask" triggers in TEAM_WORKFLOW section 3. Every role posts a daily async update (done / doing / blocked).

### R1 Owner: Product, Release and Business (Mohamed Mousa)

- **Also owns:** visual design direction (Claude Design), legal drafting with Claude, lawyer review before public launch.

- **Mission:** decide what gets built, keep the app safe and releasable, run the business side.
- **Owns:** roadmap and priorities in Linear; every merge to `main`; DB migrations; native builds and store uploads (`scripts/native-release.sh`); production secrets; pricing and subscription configuration; legal, company and store accounts; final go/no-go.
- **Paths:** `supabase/migrations/`, `scripts/`, `.github/`, `ios/`, `android/`, `capacitor.config.ts`, `CLAUDE*.md`, `docs/` (strategy docs).
- **Decides alone:** priorities, scope cuts, pricing, ship/no-ship, anything touching money, data or production.
- **Expectations:** triage new Linear tickets within 1 working day; review PRs in the merge queue daily; keep the weekly release train; keep runbooks current so another person could ship.
- **Does not do:** day-to-day feature coding (delegated), social posting, support replies.
- **Metrics:** release train on time, merge queue age under 3 days, no production incident from a merge.
- **First 30 days:** switch workflow to PR-to-`main`, create dev Supabase, set branch protection, write the launch checklist, brief the lawyer.

### R2 App Engineer: Product UI (Ahmed Fadeel)

- **Also:** required security reviewer on PRs touching `src/app/api/`, auth, `supabase/` and `src/lib/store/types.ts` (reviews, does not author); writes user stories and acceptance checklists for UI tickets.

- **Mission:** build and polish what users see and tap.
- **Owns:** screens, flows, components, interaction quality, accessibility, design-system conformance in code.
- **Paths:** `src/app/(app)/` (except `admin`), `src/components/{dashboard,expenses,transactions,onboarding,profile,reports,modals,features,layout}`.
- **Decides alone:** layout and interaction inside existing components; copy placeholders (Content finalizes).
- **Must ask first:** new component or reshaping an existing one (reuse rule in `CLAUDE.md`), any new field needing a DB change (goes to R3 + Owner), new dependency.
- **Expectations:** 44px touch targets, tokens only, light/dark, EN/AR/RTL check, screenshots in every PR; tests for logic.
- **Does not do:** API routes, SMS, migrations, copy wording, store assets.
- **Metrics:** PRs merged per week, bugs reopened by QA (aim for low), zero design-system violations.
- **First 30 days:** clear the open UI items from `docs/QA_ROUND_6.md`; empty/error/loading states audit.

### R3 Platform Engineer: Backend, Data, SMS, AI (Kareem and Mohamed Salah, shared with R4)

- **Shared role:** Kareem and Salah hold R3 and R4 together with identical scope. Split by ticket, cross-verify each other's PRs, release sign-off from the person who did not author the riskiest PR.
- **Guardrail:** dev keys only. Production secrets and migrations stay with the Owner.

- **Mission:** make the data correct, the sync reliable and the SMS/AI features trustworthy.
- **Owns:** API routes, sync, SMS ingestion and parsing, Buddgy/AI, auth, notifications, entitlements, admin portal, performance, error handling.
- **Paths:** `src/app/api/`, `src/lib/**` (except `i18n`), `src/components/{ai,auth,sync,voice,notifications,receipt}`, `src/app/(app)/admin`.
- **Decides alone:** implementation inside existing contracts.
- **Must ask first:** any schema change (writes SQL in the PR, Owner applies it), any change to `src/lib/store/types.ts` shapes, anything touching auth/tokens/payments.
- **Expectations:** tests that use the real data shape (see memory note), no silent failures, no secrets in code, security-minded review of own diff.
- **Does not do:** applying migrations, native builds, UI polish, marketing.
- **Metrics:** SMS parse success rate, sync error rate, API p95, zero data-loss bugs.
- **First 30 days:** triage the SMS delivery-watch findings; own the Google Play SMS-policy evidence; add monitoring for key endpoints.

### R4 QA, Support and Reliability (Kareem and Mohamed Salah, shared with R3)

- **Release gate:** signs off the TestFlight and Android build before the Owner ships. Owns the support inbox; community reports from R6 are routed here.

- **Mission:** nothing broken reaches users; users who hit problems get answers fast.
- **Owns:** release checklist, device matrix (iOS + Android, EN + AR, light + dark, offline), regression sweeps, bug reports in Linear with repro steps, crash/error review, support inbox, store reviews and in-app feedback, release sign-off.
- **Paths:** `docs/QA_*`, `scripts/qa/` (run, do not edit unless asked), `*.test.ts` files, Linear.
- **Decides alone:** a build fails QA ("Failed QA" status) and goes back; severity labels.
- **Must ask first:** editing non-test source files (file a ticket instead).
- **Expectations:** every bug ticket has steps, expected/actual, device/OS/app version, screenshot or video; verify each merged fix on the preview or build before moving the ticket to Done; reply to support within 24h.
- **Does not do:** shipping fixes in product code, pricing, marketing.
- **Metrics:** bugs found before release vs after, time to first support reply, QA turnaround under 1 day, escaped-bug count.
- **First 30 days:** release checklist, device test matrix, support macros, beta tester group.

### R5 Growth, Data and Finance (Mohamed Salama, "Gabal")

- **Split with R6:** R5 owns strategy, measurement, experiments, partnerships, Saudi entry and accounting. R6 executes campaigns and writes all content, including store text and website copy. R5 gets read-only analytics views, never production SQL.
- Original scope below still applies, minus content execution.

- **Mission:** get the right users to install, activate and stay.
- **Owns:** go-to-market plan and calendar, positioning and ICP, App Store and Play listings and ASO, public website and SEO, landing pages, analytics funnels and weekly report, paid and referral experiments, email lifecycle (not copy wording), partnerships, influencer and PR outreach, waitlist.
- **Paths:** `src/app/(site-en)/`, `src/app/(site-ar)/`, `src/components/site/`, `public/`, `assets/`, `docs/WEBSITE.md`, `docs/APP_STORE_SUBMISSION.md`, `docs/GOOGLE_PLAY_SUBMISSION.md`, a new `docs/growth/`.
- **Decides alone:** channels, experiments within budget, site layout in existing site components.
- **Must ask first:** budget above the agreed cap, any claim about security, savings or bank connectivity (legal), pricing or discounts (Owner), changing in-app code.
- **Expectations:** weekly one-page report (installs, activation, retention, CAC, top experiment, next experiment); every experiment has a hypothesis and a stop rule.
- **Does not do:** app code, support replies, copy for in-app strings.
- **Metrics:** installs, activation rate, D7/D30 retention, CAC, store conversion rate, site-to-install rate.
- **First 30 days:** ICP and positioning one-pager, competitor map, ASO keyword set EN/AR, site pricing page, waitlist.

### R6 Brand, Content and Community (Osama)

- **Plus:** campaign execution with R5, store listing text, website copy, help center. Arabic is written, not machine-translated; R5 reviews Saudi dialect.

- **Mission:** make Buddget sound and look like one consistent, trustworthy brand in English and Arabic.
- **Owns:** UX copy (EN/AR), `COPY_GLOSSARY`, email and notification copy, help center/FAQ, store text and social copy, social media accounts and calendar, short video, community (Discord/WhatsApp/Reddit/X), influencer content briefs, visual creatives, brand guidelines, legal text drafts for lawyer review.
- **Paths:** `src/lib/i18n/`, `docs/COPY_GLOSSARY.md`, `docs/ARABIC_REVIEW.md`, `docs/email-templates/`, `docs/buddgy/` (tone), `src/components/legal/`.
- **Decides alone:** wording and tone inside the glossary, social content.
- **Must ask first:** renaming product concepts, new legal claims, anything that changes layout (file a ticket to R2).
- **Expectations:** Arabic is written, not machine-translated; all strings go through the i18n files; posts follow the calendar; replies to community within 24h.
- **Does not do:** app code beyond i18n files, analytics, paid media.
- **Metrics:** posting cadence, engagement and follower growth, community replies time, copy defects found by QA.
- **First 30 days:** tone-of-voice guide, glossary audit vs live strings, 4-week content calendar, launch-day content kit.

## 3. Weekly rhythm

| Day | What | Who |
|-----|------|-----|
| Mon | 30 min planning: pick 1-3 tickets per person, set the week's release scope | All |
| Daily | Async update in chat (done / doing / blocked); Owner clears the merge queue | All, R1 |
| Wed | Feature freeze for this week's release (only fixes after this) | R1 |
| Thu | Owner cuts the release candidate; QA runs the checklist | R1, R4 |
| Fri | Ship if QA is green; 15 min retro; Growth posts the weekly report | All |

## 4. Rollout

| Step | Verify |
|------|--------|
| Owner decisions in section 5 | Answers recorded here |
| Dev Supabase project created and seeded | A new person boots the app with dev keys |
| Branch protection, CODEOWNERS, PR template, Linear-GitHub integration on | A test PR needs approval and links its ticket |
| 30 min onboarding per role using TEAM_WORKFLOW | Each person merges one tiny PR (typo or doc) |
| One starter ticket per role | All six lanes have merged something |

## 5. Decisions (four-voice council, 2026-11-14)

1. **PR-to-`main` for everyone, owner included; drop `dev` auto-merge.** Unanimous. Pending: update `CLAUDE.md` and memory when the owner confirms. `ci.yml` exists but Actions billing failed, so the required check is local `npm run verify` plus the Vercel preview until CI is restored.
2. **Separate dev Supabase project with fake data.** Unanimous. Team gets dev keys only; the owner alone holds production keys and applies migrations. Analytics access is a read-only view.
3. **Legal:** Claude drafts and benchmarks approved regional and global finance apps for the private beta. Council recommends a one-off paid lawyer review (hours, not a retainer) before public launch and before Saudi, covering privacy policy, terms, SMS handling and Egyptian and Saudi data-protection law. **Owner decision pending.** Accountant: Gabal, in-house.
4. **Roles:** assigned as in the table at the top. Dissent noted: one voice wanted only two or three people writing merging code. Compromise: everyone can open PRs, CODEOWNERS limits each person to their own paths, only the Owner merges.
5. **Open:** confirm GitHub plan supports branch protection on this private repo.
