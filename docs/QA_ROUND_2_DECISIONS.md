# QA Round 2 — Owner decisions (2026-10-27)

Rule agreed: the owner decides only what changes current app flow or UI/UX; everything else follows the recommendation in the report. Recorded here so the team knows what changed and why.

## Component merges (what becomes the one component)

| Group | Decision | Why |
|---|---|---|
| Sheet headers (`V3SheetHeader` 14 sheets, `ModalSheetHeader` 18, `SheetTitleBar` 4 + ~22 hand-rolled titles) | **V3 look is the target, phased.** Step 1: one component with variants, no visible change anywhere (old callers keep their look). Step 2 (separate commit, stoppable): move the 18 + 4 sheets to the V3 look. All headers call `useModalTitleId` so every sheet gets an accessible name. | V3 is the newest design (Revamp Kit; DESIGN_SYSTEM names it for new screens, supports subtitle + extra slot). Phasing keeps drift reviewable. |
| Currency pickers (`CurrencySheet` 44 lines, `CurrencyDualSheet` 149, over `CurrencyList`) | One `CurrencySheet` with a `dual` prop over `CurrencyList` (CurrencyList is the newest, Oct 25). No visual change. | 1 consumer each, 0.46 code overlap. |
| Settings rows (`SettingsToggleRow` 3 users, `SettingsSwitchRow` 6 users, newer) | `SettingsSwitchRow` is the target; ToggleRow becomes a thin wrapper then is removed. No visual change. | Same markup; SwitchRow is newer and was just reused in review. |
| Empty states (`ui/EmptyState` Apr 2026, 11 screens; six bespoke Oct 2026 copies) | **Extend `EmptyState`** with additive props (`illustration`, `cta`) so it renders the newer layouts exactly; migrate the six copies. The 11 existing screens do not change. | Keeps every screen's current look; removes ~150 duplicated lines. |
| Debt carousel cards (`BorrowHeroCard`, `CreditCardHeroCard`, `InstallmentHeroCard`) + `FlowSummaryBand` | One `DebtCard` with `kind`; `FlowSummaryBand` rendered through `HeroBand` slots. **Pixel-identical, done last, verified with before/after screenshots; any shift reverts that card.** | ~120 duplicated lines; HeroBand is the standard per CLAUDE.md. |
| Date entry (3 native `<input type=date>` in AssetFormSheet, PocketFormSheet, ExpenseSheetForm) | Use `DatePickerField` (DESIGN_SYSTEM: all date surfaces look identical). | Consistency, one small visible change in 3 forms. |
| Auth fields | `AuthPasswordField` reused by reset-password page. | Duplicated raw inputs. |
| Pills | Hand-rolled pills move to `Badge`/`StatusPill` variants (keep both). | No visual change. |
| Money sheet blocks (Income/Assign/AmountReceived/Move/Update/Add/Withdraw) | Shared blocks move into `MoneySheetParts`. No visual change. | ~200 lines. |
| Dead code | Delete ~1,450 lines (11 unreferenced components, 7 unused shadcn primitives, dead exports) with `tsc` as gate. **`ReceiptDetailSheet` is not deleted: it is wired up** (below). | Safe, verified by grep. |

## Flow / UX changes

| Topic | Decision |
|---|---|
| Receipt breakdown + photo | Wire `ReceiptDetailSheet` into the expense detail/edit sheet when an expense has a receipt, translate to Arabic, delete the photo when the expense is deleted. |
| "Left to spend" | One definition everywhere = **budget minus spent** (the hero). Buddgy, AI context and the savings sheet quote the same number. Cash flow stays on Flow/Reports labelled "Net cash flow". Reports "Total out" excludes transfers/ATM/card payoff/top-up/savings like the hero and respects `monthStartDay`. |
| Deleting linked records | Deleting a debt payment also removes its paired expense (and the reverse), with confirm for money moves and an **Undo toast**. Income swipe-delete gets Undo. "Confirm paid" hides after success and ignores a second tap. |
| Buddgy `add_expense` | Stays one-step but with guardrails: max amount, date within ±7 days, max 5 auto-adds/minute, then asks for a tap. |
| Pay debt | Currency picker (existing `CurrencySheet`) defaulting to the debt's currency. |
| Zakat | "Save" stores the calculation only; a new explicit "Mark zakat as paid" button records payment and starts the next hawl. |
| Password change | Needs the current password, signs out all other devices, clears biometric + trusted-device bindings (this device re-trusted). 2FA enforced by the server. |
| Notifications | Sent around 09:00 in each user's own timezone (hourly cron); overdue alerts at day 1, 3, 7 then weekly (max 6); month-end alert fixed. |
| iOS floor | Deployment target raised to **16.4**; lookbehind regexes in client code rewritten anyway. |
| Week start | New Settings option "First day of week" (Saturday/Sunday/Monday); default Saturday for Egypt/Gulf timezones, Sunday otherwise; applied once to existing users, changeable. |
| Accessibility visuals | Buttons keep their look but get an invisible 44px tap area; focus ring darkened to 3:1 (same neutral hue); category chip tokens nudged to pass contrast; pale-on-light text fixed to tokens. |
| Arabic | App stays LTR everywhere (settings rows un-mirrored); ~156 missing strings written in simple Modern Standard Arabic matching existing copy; the owner reviews the Arabic list before it ships. |
| Data repair | Safe repairs are automatic with a backup table first (link the 21 unlinked debt-payment expenses; re-attach income events hidden by deleted sources). Risky ones (historical gold conversions) are audited and shown for approval before any write. |

## SMS data lifecycle (owner asked for a recommended structure; policy numbers stay adjustable)

Goal: learn from every SMS, especially before launch, keep raw text 30 days, never keep OTP/rejected text longer than needed, and stay acceptable to Google Play and the App Store.

**"Masked shape" means** the message with personal parts replaced by placeholders but the wording and layout kept, e.g. `Your account was debited EGP AMOUNT at MERCHANT ref REF on DATE`. It lets the learner see the pattern without a name, number or amount.

Proposed lifecycle (this is also how the existing design already intends to work: a `harvested_at` flag and a corpus table of masked bodies):
1. **Ingest:** raw text stored on the owner's row (visible only to the owner; staff see the masked shape). OTP code digits are masked at ingest.
2. **Learn ("harvest"):** every message, including rejected/OTP/marketing, is run through the pipeline; its masked shape is saved to `sms_corpus` (counts, which parser matched, outcome). The row gets `harvested_at`.
3. **Purge, by class:**
   - Rejected / OTP / marketing: raw text deleted as soon as the shape is harvested; hard cap 7 days if harvesting never happens, with an alert.
   - Parsed transactions: raw kept **30 days** (undo, confirm, corrections, debugging), then replaced by the masked shape in the same row.
   - Never-harvested rows past 30 days are held to 60 days maximum, then purged with an alert (the learning pipeline is broken).
4. **Config:** all periods live in `platform_settings`, so the policy can be adjusted later without code.
5. **Fixes needed for this to work:** `raw_body` must allow NULL (the nightly job has failed 4 of 4 runs), masking must cover Arabic and Title-Case names (today it misses them), learned regexes must not store per-user literals, and the AI call should receive masked text where the amount/merchant is not needed.

**Store acceptance (checklist, to verify before submission):**
- Google Play restricts SMS permissions (READ_SMS/RECEIVE_SMS) to specific approved use cases and requires a Permissions Declaration; expense tracking from SMS needs a justified, declared core use. This is the biggest store risk and must be checked in Play Console policy before the next Play submission. Remove unused `READ_SMS` if only receive is needed. Add a prominent in-app disclosure and explicit consent screen before enabling SMS tracking, and fill the Data Safety form (SMS content, financial info, processed by Google Gemini, retention, deletion).
- Apple has no SMS access: the iOS path is a user-built Shortcut; declare the shared message text in the App Privacy label, link a privacy policy that matches reality (the current policy omits Sentry, the email provider and Linear and says SMS text is not stored).
- Disclose AI processing (Gemini) of SMS and receipts in the policy and consent text; mask personal data before AI calls where possible.

## Addendum: learning funnel upgrades and monthly pre-purge review (owner request)

### Learning funnel fixes and enhancements (batch B4, in addition to the N* findings)
- **LF1** Strip invisible bidi/format marks (U+200E/F, U+202A-E, U+2066-9, U+FEFF) and normalise Arabic-Indic digits and separators once at ingest and again before the learner, so learned regexes are not poisoned by them (69 of 78 regex failures contained bidi marks).
- **LF2** Teach the learner and template applier every date/time format seen in history (dd/mm/yy(yy), dd-mm, `dd-mm hh:mm`, month names, Arabic digits, 12/24h); the learner must not reject a template because the datetime is unparseable when the body has no year (210 such failures).
- **LF3** Schedule `harvestLegacySms` (daily, batched) and backfill all existing history into the masked corpus and the learner queue before launch.
- **LF4** Learner retry by failure class (bad datetime, regex too loose, gate rejected) with the reason stored in `learn_status`, plus a coverage view in the admin portal (share of SMS per bank handled by curated/template/AI tier; top unlearned shapes).
- **LF5** Replay harness: before any template is promoted (and before every parser release) replay all stored masked shapes and the golden fixtures against it; promotion blocked if a previously-correct shape regresses.
- **LF6** Corpus masking quality: cover Arabic and Title-Case names, account/phone/reference numbers, amounts; an automated leak scanner over `sms_corpus` and `sms_corrections`; learned regexes must not embed per-user literals.
- **LF7** Learner sees rejected-but-transactional shapes (e.g. marketing wrongly rejected) as negative/positive examples for the filter tuning, never for OTP bodies.

### Monthly pre-purge review (analysis before raw text is replaced by the masked shape)
What was asked: a button that starts a Claude session on the owner's account to freely analyse all SMS (unlearned patterns, links between messages and patterns, failures) before each 30-day purge.

What is possible:
- A web button inside Buddget cannot start a session on the owner's own Claude account; accounts and subscriptions are not callable from a server. What can run on the owner's account automatically is a **scheduled task in the Claude desktop/Claude Code app** (monthly, on the owner's computer, read-only through the Supabase connector). A fully server-side automation would need an Anthropic API key and its own billing.
- Decision (recommended structure):
  1. **PR1 Admin "Pattern review" page** (owner + admins with the SMS permission): countdown to the next purge batch, a banner CTA "N days to purge, analyse before masking", a generated **review pack** (see below), a "Copy review prompt" button with the standing prompt, and a "Mark reviewed" action with notes. The purge job holds un-reviewed raw text up to the 60-day cap, then purges anyway with an alert.
  2. **PR2 Monthly scheduled Claude review** on the owner's account (set up with the scheduled-tasks tool once PR1 exists): runs the standing prompt against the review pack through read-only SELECTs, writes findings to a report row/file the admin page shows, and never writes data.
  3. **PR3 (later, optional)** a server job using the Anthropic API for fully hands-off analysis; needs API key, budget and a privacy review.
- **Review pack = privacy-minimised, pattern-rich**: skeleton text with names, phone, account, reference numbers and amounts masked but wording, layout, currency, bank, sender, parse tier, outcome, failure code, counts and links (paired legs, corrected rows) kept; plus raw examples only for the owner's own messages. Reason: other users' raw messages are personal financial data and the policy says staff see masked data; the masked pack contains everything a pattern review needs.

### Should masked messages be kept or permanently deleted?
Recommendation: **permanently delete the raw text; keep the masked shapes** (deduplicated by shape with counts, so a few thousand rows, negligible storage).
Why they are worth keeping: they are the learner's memory (new templates are tested against all past shapes before promotion), they are regression fixtures for parser releases, they show per-bank coverage and when a bank changes its format, and they let a future review find patterns without re-collecting data. Risks and controls: masking must be reliable (LF6 leak scanner), shapes have no user id, shapes seen fewer than 3 times are dropped after 180 days (today 30), and a user's account deletion cannot be linked to shapes because they carry no identity.

## Addendum 2: further owner decisions (2026-10-27)

| Topic | Decision |
|---|---|
| Deposit source (W2) | Pocket deposit sheets get a **"From account" row**, defaulting to the primary tracked account (existing account selector), hidden when no tracked accounts. Recurring deposits and Buddgy use the primary account. |
| Arabic strings | **Ship with the batch, owner reviews after**; wording fixed afterwards. |
| Notification scheduler | **Supabase pg_cron + pg_net** (enable pg_net) calling the notifications route hourly with the cron secret; Vercel daily cron stays as backup. |
| Copy | **Standardise with a glossary**, app-wide, en + ar: Delete = permanent, Remove = detach/unlink; "expense" for spending, "transaction" only for mixed lists; "Savings" the area, "saving" only as a verb; "Budget" for the plan users see; one calm error tone. Glossary is shown to the owner for approval before the sweep. |
| Prompts | Push pre-prompt sheet; Buddgy asks once before navigating; 2FA off needs re-auth; memory proposals default OFF for new users (existing keep theirs). **No "Export my data" feature this round.** |
| Visible fixes | **All approved:** Flow ordered by occurredAt; pocket delete asks confirm + Undo; hero budget excludes the "grow" block; Over-pace chip no longer false-fires from day 1; on-brand 404 with a way back. Before/after examples go in the commit notes. |
| SMS sender checks | **Strict for credits, lenient for debits:** incoming credits must match the bank's known senders or go to confirm; purchases/debits stay auto-booked. Salary "confirm" decisions actually post. |
| Retention order | Raw text is NOT purged early: the nightly job keeps failing (harmless) until the learning backfill (LF3) and masking fixes (LF6) are done in B4; only then `raw_body` becomes nullable and the job is enabled. |
| Deferred by design | Field/card border contrast (U26), muted-text contrast on elevated surfaces (U27), hero gradient contrast (U29): large visual change, not approved; revisit later. |
