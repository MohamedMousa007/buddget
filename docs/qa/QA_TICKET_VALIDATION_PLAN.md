# QA audit tickets: validation and fix plan

Date: 2026-11-18. Code validated: `origin/main` at `fe5b2097`. Tickets: Linear team QA, QA-10 to QA-124 (115 tickets).
Status: **for owner review. Nothing has been implemented, no ticket was changed, no database write was made.**

How this was done: ten reviewers each took one area, read every ticket, traced the code path at HEAD, and checked live database catalog state (grants, functions, migration ledger, advisors) where a ticket depended on it. The audit's own reports (`docs/qa/comprehensive-audit/`) are not on this machine, so validation is from the ticket text and the code. Nothing was run on a device. Five of the highest-stakes claims were re-checked by hand after the reviewers reported (pocket form field, flush baseline, OTP inputs, app `dir`, build flag) and held.

## 1. Result

| Verdict | Count | Meaning |
|---|---|---|
| Confirmed | 70 | Real, still on main |
| Partial | 22 | Part of the ticket is real; the rest is by design or wrong |
| Not a bug | 14 | Works as designed, or the audit misread it |
| Already fixed | 1 | QA-124 |
| Needs your call | 8 | Cannot be judged from code |

Severity after review: 1 P0 (QA-10), 6 P1 (QA-11, 12, 13, 15, 16, and QA-50 raised from P2), about 17 P2, the rest P3. QA-14 was lowered from P1 to P2: a spoofed but well-formed bank SMS books the same income without any prompt injection, so the injection is not the real exposure.

## 2. What I need from you

### 2a. Tickets where I cannot tell bug from intended (the 8 "needs your call")

| # | Ticket | Question | Recommendation |
|---|---|---|---|
| U1 | QA-57 Linear feedback outbox never drains | Should in-app bug reports create Linear issues now? The cause is a missing `LINEAR_API_KEY` in Vercel, which I cannot read. This is the support-form outbox, not the inactive release bot. | If yes, set the key. If no, clear the one stuck row so the health check stops reporting "degraded". |
| U2 | QA-99 check-email reveals whether an email is registered | The email-first sign-in screen needs this signal, so it looks deliberate. Is that an accepted product choice? | Keep it, add a per-IP daily cap and fail closed. |
| U3 | QA-93 (with QA-90) Flow shows ATM moves but not goal or pocket funding | What is Flow's rule for money moving between your own places? (A) as today, (B) show every internal move, muted and badged, (C) hide all non-spend rows behind a filter. | No recommendation; this is a product rule. QA-90 on its own is by design. |
| U4 | QA-111 Buddgy launcher covers row amounts | The figure is draggable and sits bottom-right by design. Keep, default to the left edge, add scroll clearance under lists, or both? | Scroll clearance only. |
| U5 | QA-117 Zakat prompt covers the Wealth header; tablet layout | (1) The prompt shows to every user on every Wealth visit and returns 3 hours after a snooze. Keep, shorten, or show only when the answer changes the result? (2) Tablets 768 to 1023 px get a stretched phone layout. Accept, cap and centre, or commission a tablet layout? | (1) Show only when it matters. (2) Cap and centre. |
| U6 | QA-74 iPad allows all orientations | Is iPad supported at launch? Apple does not let you remove iPad support after the first release. | Decide before the first App Store release. |
| U7 | QA-76 PWA opens fullscreen, hiding the Android status bar | This was a deliberate edge-to-edge choice (`edb74674`). Status bar visible or hidden? | Visible (standalone). |
| U8 | QA-84 one cold load produced 2,145 React commits | Seen once; no render loop found in code. | Fix QA-22 first, re-profile three times, close if under about 200 commits. |

### 2b. Decisions that block a P0/P1/P2 fix

| # | Ticket | Decision | Recommendation |
|---|---|---|---|
| D1 | QA-10 | Only you can open the Supabase dashboard for the Frankfurt project. Check: email OTP length is 6, the Send Email hook is on and its secret matches `SEND_EMAIL_HOOK_SECRET` in Vercel, templates print the code, custom SMTP is set. These look reset by the region move. Also confirm: is verification code-only on every platform, and which project do the installed iOS and Android builds point at? | Set length to 6 in the dashboard today; the code change (inputs driven by one length constant) follows. |
| D2 | QA-13, QA-122 | A pocket created "from an account you already have": is it an earmark inside that account, or money moved out of it? Today it is neither, so it is counted twice. Should existing linked pockets be backfilled? | Earmark (matches `docs/ACCOUNTS_REFACTOR_MASTER_PLAN.md`); backfill. |
| D3 | QA-12 | Budget Studio "saved right now" when the user already tracks accounts: (a) ask but create nothing, (b) skip the question and read account balances, (c) create an earmark in a chosen account. | (a), the smallest fix. |
| D4 | QA-11 | Existing same-day rows without a time: repair on read (falls back to created time; may double-count for anyone who already corrected by hand) or leave. | Leave; fix forward. |
| D5 | QA-14 | Should income, transfer-in and refund read by the AI tier wait for a one-tap confirmation: always, only when the deterministic check fails, or never? | Only when the check fails. |
| D6 | QA-41 | Fix needs "a delete can only be undone by an action newer than the delete". That overrides round-6 decision REG-6, and installed native builds lose undo-after-sync until rebuilt. | Accept. |
| D7 | QA-47 | About 10 existing purchases are booked one day late. Repair them or fix forward only? | Fix forward. |
| D8 | QA-49 | When a hand-marked payday and the bank SMS differ by 2 to 15%: replace the amount after the existing salary prompt, or silently? | After the prompt. |
| D9 | QA-23 | A family or friends debt with no monthly payment given: budget balance ÷ 12, or leave at 0? | Balance ÷ 12 (what the debt record already assumes). |
| D10 | QA-24 | Reports month-by-month "Money in": label it "(expected)", show expected and received, or show received only? | Label it. |
| D11 | QA-65 | Sign-out: keep "send last edits, then wipe" with a 3 s timeout, or wipe first and risk the last unsent edit? | Keep, add the timeout. |
| D12 | QA-28, QA-29 | Both are blocked by the Supabase plan, not by code. The password-attempt hook needs the Team plan and leaked-password protection needs Pro; the organisation is on Free. Upgrade, add CAPTCHA on sign-in instead, or accept until launch? | Upgrade to Pro before launch (closes QA-29); CAPTCHA for QA-28. |

### 2c. Smaller decisions (a default is proposed; say so only if you disagree)

- QA-33: identical SMS within 3 minutes are booked and flagged by rule. Keep. QA-31 is then fixed to route into the same rule.
- QA-34: a transfer seen on two phones always asks. Change so pairs you already answered "both mine" settle without asking.
- QA-36: mask names, phones, account and reference numbers before the AI parse; keep balances (the model needs them).
- QA-37: do you make same-currency transfers between your own HSBC accounts? They are labelled "Currency Exchange" and never pair.
- QA-32, QA-103: no change without a real sample SMS (a two-transaction message, an HSBC ATM withdrawal). Send one if you have it.
- QA-39: confirm the injected template `42e20b95…` was deleted in the audit cleanup; if not it should be retired.
- QA-53: should a suspended account still be able to send a support ticket? Default: yes, gate only feedback and board votes.
- QA-56: `/api/health/deep` is public by documented design. Default: leave and close.
- QA-59: hash the email in `trial_claims` with plain SHA-256 (one migration, no new secret).
- QA-61: the migration ledger drifts because the workflow applies with `execute_sql`. Default: document that the repo folder is the record.
- QA-62: block only absurd dates (2000 to 2100 table check).
- QA-66: app links for invite links only.
- QA-71: keep the wide Android SMS gate, correct the privacy wording that says "bank" only.
- QA-77: tablet and desktop PWA installs stay portrait-locked.
- QA-78, QA-80, QA-81: defer (no user is near the scale where they bite). Triggers are in the detail sections.
- QA-82: turn the Reports chart animation off for everyone.
- QA-86: "Saves X% of income" describes the plan today. Reword it, or switch it to actuals?
- QA-89: no category preselected in the add-expense sheet.
- QA-91, QA-121: one rounding rule. QA-121 is a real truncation bug and is fixed either way.
- QA-94: keep both debt-free dates with distinct labels.
- QA-97: `/buddgy` deep link: close as not planned unless emails or push will link there.
- QA-101: if our role cannot revoke on platform-owned `net.*` functions, close as an accepted platform default.
- QA-102: keep the non-expiring ingest token (by design); fix only the cookie-authenticated GET.
- QA-106: keep "newest edit wins" per item (documented).
- QA-112: rename "Monthly equivalent" to "Per month" and "Everywhere" to "All".
- QA-114: the doubled currency label could not be found in code; where did the tester see it?
- QA-120: effect is history only; one-off repair of about 15 rows, or nothing.
- QA-27: keep the English-order layout in Arabic (a full RTL mirror would be its own project).

## 3. Proposed fix order

Each batch is one change set with its own verify run. Detail for every ticket is in section 6.

**Batch 0. Owner actions, no code.** D1 (Supabase auth settings, QA-10), D12 (plan tier, QA-28/29), U1 (Linear key, QA-57).

**Batch 1. Money is wrong or lost (P0/P1).**
- QA-10 code half: every OTP input reads one length constant.
- QA-15 + QA-16 + QA-50 + QA-40, one build: a single mapper helper that sends null instead of `pm_default_cash`; the pay-debt sheet stores the real Cash account id; the reconcile baseline keeps refused rows held back; a one-time persist migration re-sends debt payments and their linked expenses that devices already recorded as delivered. QA-107 ships after this.
- QA-11 + QA-118: stamp `occurredAt` on manual income and debt payments (one store change).
- QA-13 + QA-122 + QA-12 + QA-119: pocket form writes `heldInPaymentMethodId`; Budget Studio stops creating a pocket for money already in accounts; the auto-seeded empty vault no longer blocks the savings answer. One shared net-worth test. Needs D2 and D3.
- QA-18 + QA-26: apply the existing `pickablePaymentMethods` helper in the five pickers that still show two "Cash" entries.

**Batch 2. Sync races.** QA-19, QA-20, QA-65 (one window in `SupabaseFinanceSync.ts`), QA-22 (double first pull), QA-42, QA-41, QA-43, then re-profile QA-84.

**Batch 3. SMS pipeline.** QA-14 + QA-39 (check the AI's output against the message, separate the prompt, learn only after the hold decision), QA-36, QA-38 (closes QA-48), QA-37, QA-47, QA-49, QA-31, QA-35, QA-104, QA-105 ("ج.م" token only), QA-120.

**Batch 4. Database, API, security.** One migration: QA-17 (rate-limit bucket), QA-60 + QA-62 (table CHECK constraints), QA-59, QA-30, QA-98, QA-101. Routes: QA-51 (closes QA-55), QA-52, QA-53, QA-54, QA-58, QA-100, QA-102. Doc: QA-61.

**Batch 5. Web UI and functional P3.** QA-23, 24, 25, 64, 86, 87, 88, 89, 91, 121, 92, 94, 95, 123, 27, 45, 46, 109, 110, 112, 113, 114, 115, 116, 108, 79, 82, 83.

**Batch 6. Native, next store build.** QA-21 + QA-72 (biometric and admin unlock secrets into the encrypted store, library off alpha), QA-67, QA-69, the advertising-ID finding below, QA-66 (large), QA-71 wording, QA-76 + QA-77 (one manifest edit).

**Deferred or watch:** QA-32, 78, 80, 81, 84, 93, 97, 111, 117, 74.

**Close with no change (15):** QA-33, 34, 44, 56, 63, 68, 70, 73, 75, 85, 90, 96, 103, 106, and QA-124 (already fixed).

## 4. Findings the audit did not file

1. **Advertising-ID permissions in the Android build (P2 before a Play upload).** The merged manifest carries `AD_ID` and four `ACCESS_ADSERVICES_*` permissions, pulled in by the Facebook SDK that the social-login plugin bundles. The app has no Facebook sign-in and the store documents state there is no advertising identifier. Fix: one line, `socialLogin.facebook.include=false` in `android/gradle.properties`.
2. **Rows tombstoned at the localStorage quota (medium confidence, reasoned from code, not run).** `saveFingerprint` still writes while the store write is refused at quota; on the next cold start, rows added at the limit are classed "deleted offline" and the first flush deletes them on the server. Only reachable at about 12,000 expenses. Small fix in the QA-81 plan.
3. **The admin-portal unlock secret** (`src/lib/native/adminBiometric.ts`) has the same plain-storage defect as QA-21; fix together.
4. **`rtl:` styles never apply in production.** The app sets `dir="ltr"` in every locale and the webpack build keeps `:dir(rtl)`, so all 18 `rtl:` rules are dead. That is why QA-44 (Arabic switch thumb) is not a bug in production: the audit ran a Turbopack build. The only thing protecting production is the `--webpack` flag in `package.json` and `scripts/capacitor-build.mjs`.
5. **`no-scrollbar` is not a defined class** (QA-123); it is used in six files. The real utility is `.hide-scrollbar`.

## 5. Index of all 115 tickets

Sev = severity after review. Effort: S under 1 h, M half a day, L a day or more.

| Ticket | Audit id | Verdict | Sev | Effort | One line |
|---|---|---|---|---|---|
| QA-10 | E2E-001 | Confirmed | P0 | S + M | Every OTP input is fixed at 6; live auth settings look reset by the region move |
| QA-11 | E2E-002 | Confirmed | P1 | S | Manual income and debt payments never stamp a time; the noon fallback drops them |
| QA-12 | QA-001 | Confirmed | P1 | S | Studio creates a pocket for money already in tracked accounts |
| QA-13 | QA-013 | Confirmed | P1 | S-M | Sheet writes `linkedPaymentMethodId`; every money reader uses `heldInPaymentMethodId` |
| QA-14 | SMS-011 | Confirmed | P2 | M | No check of AI output against the message; a well-formed spoof books the same income |
| QA-15 | SYNC-001 | Confirmed | P1 | S | `pm_default_cash` is sent into a uuid column |
| QA-16 | SYNC-002 | Confirmed | P1 | M | Reconcile replaces the held-back baseline with the full snapshot |
| QA-17 | DB-001 | Confirmed | P2 | S | `api_rate_hit` rounds the epoch, giving two buckets per window |
| QA-18 | E2E-005 | Partial | P3 | M | Second Cash row is by design; several pickers fail to hide the built-in one |
| QA-19 | E2E-006 | Confirmed | P2 | M | A pull replaces the profile wholesale; three unserialised profile writes per step |
| QA-20 | E2E-008 | Confirmed | P2 | S | The achieved flip does not bump `updatedAt`, so a pull's tie reverts it |
| QA-21 | NAT-001 | Confirmed | P2 | M | Biometric and admin unlock secrets sit in plain Preferences |
| QA-22 | PERF-001 | Partial | P3 | S | Double full pull on first sign-in is real; the warm-load half is not |
| QA-23 | QA-019 | Confirmed | P2 | M | Builder lines lose their ids on save; each line is compared with all debts |
| QA-24 | QA-021 | Partial | P3 | S | The figure is the deliberate expected number; the label drops "(expected)" |
| QA-25 | QA-023 | Confirmed | P3 | S | `get_net_worth` omits the accounts total, so the parts cannot sum |
| QA-26 | QA-024 | Confirmed | P3 | S | Leading "add a" and "paid with cash" are not stripped |
| QA-27 | QA-027 | Partial | P2 | M | `.font-mono-numbers` forces LTR on mixed Arabic and number strings |
| QA-28 | SEC-001 | Confirmed | P2 | S or L | Hook absent live; it needs the Team plan; the file exists only on `auth-hardening` |
| QA-29 | SEC-002 | Confirmed | P2 | S | Dashboard toggle that needs the Pro plan |
| QA-30 | SEC-003 | Confirmed | P2 | M | `db_pre_request` never checks `auth.sessions` |
| QA-31 | SMS-001 | Confirmed | P3 | S-M | No-capture-id text never reaches the book-and-flag rule |
| QA-32 | SMS-002 | Confirmed | P3 | M | Every tier returns one transaction; the test input was constructed |
| QA-33 | SMS-003 | Not a bug | - | - | Book and flag is the written rule when there is no reference or balance |
| QA-34 | SMS-004 | Not a bug | - | - | Documented: without a same-device signal the pair asks, and it did |
| QA-35 | SMS-005 | Confirmed | P3 | S | Trust is tested over 10 rows but the newest row is quoted |
| QA-36 | SMS-006 | Confirmed | P2 | M | Main parse and the merchant categoriser send the raw SMS |
| QA-37 | SMS-007 | Partial | P2 | S | The label is intended; the HSBC patterns never capture the account |
| QA-38 | SMS-012 | Confirmed | P2 | M | A shared reference never widens the 300 s window |
| QA-39 | SMS-013 | Confirmed | P2 | S | Learning is queued on the AI's own confidence before any hold |
| QA-40 | SYNC-003 | Partial | P3 | S | Mapper is unguarded, but no client path sends the sentinel there today |
| QA-41 | SYNC-004 | Confirmed | P3 | M | A stale-fingerprint boot re-inserts rows another device deleted |
| QA-42 | SYNC-005 | Confirmed | P3 | S | Flush runs before the reset check |
| QA-43 | SYNC-006 | Confirmed | P3 | M | A foreign-tab write drops a pending edit; 150 ms window, web only |
| QA-44 | UI-001 | Not a bug | - | - | `rtl:` never matches in the production build; the thumb is inside the track |
| QA-45 | UI-002 | Partial | P2 | S | The route announcer reads an h1 that main tabs keep outside `<main>` |
| QA-46 | UI-003 | Partial | P2 | S | Wealth pills' hit overlay is displaced; the other two named controls are fine |
| QA-47 | X-001 | Confirmed | P2 | S | `resolveSmsDay` accepts a body date after the capture day |
| QA-48 | X-003 | Partial | P3 | S | Impact is true; root cause is pairing (QA-34, QA-38) |
| QA-49 | X-004 | Confirmed | P2 | M | A taken payday creates a second income regardless of who marked it |
| QA-50 | X-005 | Confirmed | P1 | S-M | The sentinel is the default chip; the payment is set aside, then marked delivered |
| QA-51 | API-001 | Confirmed | P3 | S | Null body 500s in four routes; typed-field 500s in three auth routes |
| QA-52 | API-002 | Confirmed | P3 | S | No rate limit, dedupe or retention |
| QA-53 | API-003 | Confirmed | P3 | S | Local JWT check is deliberate; only feedback and support writes need gating |
| QA-54 | API-004 | Confirmed | P3 | S | Random id without the header; junk limiter rows, no bypass |
| QA-55 | API-005 | Partial | P3 | S | Shape is uniform; only wording differs; closes with QA-51 |
| QA-56 | API-006 | Not a bug | - | - | Public by documented design |
| QA-57 | API-007 | Needs your call | P3 | S | Row still pending; cause is a Vercel env value I cannot read |
| QA-58 | API-008 | Confirmed | P3 | S | Offset paging on a non-unique column; admin-only |
| QA-59 | API-009 | Confirmed | P3 | S | `email_key` is the clear normalised address |
| QA-60 | DB-002 | Confirmed | P3 | M | NaN passes RPC guards and table checks |
| QA-61 | DB-003 | Confirmed | P3 | S | 303 files, 277 ledger rows; the 0298 clash is only on an unmerged branch |
| QA-62 | DB-005 | Confirmed | P3 | S | No date bound in RPCs or tables |
| QA-63 | E2E-003 | Not a bug | - | - | Radio buttons take their name from visible text |
| QA-64 | E2E-004 | Confirmed | P3 | S | `fabAskAi` is "Set up your budget" in both languages |
| QA-65 | E2E-007 | Partial | P3 | S-M | Wipe waits on the final flush by design; an in-flight pull can rewrite after it |
| QA-66 | NAT-002 | Confirmed | P3 | L | No app links; real impact is invite links |
| QA-67 | NAT-003 | Confirmed | P3 | S | No `uses-feature` anywhere; matters once on Play |
| QA-68 | NAT-004 | Not a bug | - | - | Both permissions are needed (biometric on API 24-27, WebView audio) |
| QA-69 | NAT-005 | Confirmed | P3 | S | MainActivity grants the microphone to any requesting origin |
| QA-70 | NAT-006 | Not a bug | - | - | Deliberate, bounded by 5 h backoff and 30-day eviction |
| QA-71 | NAT-007 | Partial | P3 | S | Gate is deliberate; the public privacy wording says "bank" only |
| QA-72 | NAT-008 | Confirmed | P3 | S | Pinned to an alpha; stable 1.1.0 exists |
| QA-73 | NAT-010 | Not a bug | - | - | The export re-signs with `aps-environment` production |
| QA-74 | NAT-011 | Needs your call | P3 | S | iPad landscape uses the desktop layout; depends on iPad support |
| QA-75 | NAT-012 | Not a bug | - | - | iOS gives no sender; the control is server-side |
| QA-76 | NAT-013 | Needs your call | P3 | S | Fullscreen-first was a deliberate choice |
| QA-77 | NAT-014 | Partial | P3 | S-M | Missing id, categories, screenshots are real; the rest is deliberate |
| QA-78 | PERF-002 | Partial | P3 | S | No windowing, but the ledger is already paged; two small wins remain |
| QA-79 | PERF-003 | Confirmed | P3 | S | `fetchGoldPrice` has no in-flight guard |
| QA-80 | PERF-004 | Confirmed | P3 | M | One root layout imports the shell and all 17 views, by design |
| QA-81 | PERF-005 | Confirmed | P3 | S | Whole store in one localStorage key; quota is handled |
| QA-82 | PERF-006 | Confirmed | P3 | S | Reports charts animate by default |
| QA-83 | PERF-007 | Confirmed | P3 | S | Cookie sync runs on every load; legal pages mount the chat bubble |
| QA-84 | PERF-009 | Needs your call | P3 | S | Seen once; no loop found |
| QA-85 | PERF-010 | Not a bug | - | - | Filed as info |
| QA-86 | QA-003 | Partial | P3 | S | Zero-income guard exists; 100% comes from expected income with no budget |
| QA-87 | QA-004 | Confirmed | P3 | S | A past date prints under "Next cycle"; debts have no overdue state |
| QA-88 | QA-006 | Confirmed | P3 | S | `?? b.balance` fallback is still there; latent |
| QA-89 | QA-008 | Confirmed | P3 | S | Default category is the first chip |
| QA-90 | QA-009 | Not a bug | - | - | One muted row with a "Not counted" badge, excluded from totals |
| QA-91 | QA-011 | Confirmed | P3 | S | Big number 2 decimals, cells whole; no written rule |
| QA-92 | QA-012 | Confirmed | P3 | S | The nudge has no age check |
| QA-93 | QA-017 | Needs your call | P3 | M | Flow reads expenses and income only; no stated intent for savings moves |
| QA-94 | QA-020 | Confirmed | P3 | S or M | Budget uses the snowball simulation; Debts uses the contractual end date |
| QA-95 | QA-022 | Confirmed | P3 | S | Caption is a fixed string; biggest purchase includes debt-linked expenses |
| QA-96 | QA-025 | Not a bug | - | - | Amounts are plain text; a tool artefact (not device-tested) |
| QA-97 | QA-026 | Confirmed | P3 | S | No `/buddgy` route; a missing feature, nothing links there |
| QA-98 | SEC-004 | Confirmed | P3 | M | Array and FK-less link columns are unguarded; low impact |
| QA-99 | SEC-005 | Needs your call | P3 | S | Enumeration is deliberate for the email-first screen |
| QA-100 | SEC-006 | Confirmed | P3 | S | `*.supabase.co` and `img-src https:` are still in the CSP |
| QA-101 | SEC-007 | Confirmed | P3 | S | 0315 covers `public` only; `net.*` is executable by everyone |
| QA-102 | SEC-008 | Partial | P3 | S | Non-expiry is by design; the cookie-authenticated GET is real |
| QA-103 | SMS-008 | Not a bug | - | - | `verified:false` is the rule for patterns with no real sample |
| QA-104 | SMS-009 | Confirmed | P3 | S | The balance regex needs "balance is" adjacent |
| QA-105 | SMS-010 | Partial | P3 | S | Missing banks are backlog; only "ج.م" is a defect |
| QA-106 | SYNC-007 | Not a bug | - | - | "Newest edit wins" per item is documented |
| QA-107 | SYNC-008 | Confirmed | P3 | S | A full pull keeps absent rows edited after the cutoff; after QA-16 |
| QA-108 | UI-005 | Confirmed | P3 | M | Client-only seed with a random id |
| QA-109 | UI-006 | Partial | P3 | S | Chips have 44 px overlays; clipped in three scrollers |
| QA-110 | UI-007 | Confirmed | P3 | S | 32 monogram brands are under 4.5:1 |
| QA-111 | UI-009 | Needs your call | P3 | S | Draggable, bottom-right by design |
| QA-112 | UI-010 | Confirmed | P3 | S | Three single-line truncations |
| QA-113 | UI-011 | Partial | P3 | S | 89 lines in 21 files; only 5 are real violations |
| QA-114 | UI-012 | Partial | P3 | S | Stored "Cash" and the English currency name are shown raw |
| QA-115 | UI-013 | Partial | P3 | S | Double h1 is one hidden header; real gaps are landmarks and labels |
| QA-116 | UI-014 | Confirmed | P3 | S | Money in uses 16 px gutters and a 32 px pill |
| QA-117 | UI-015 | Needs your call | P3 | S or L | Prompt stack overlays by design; no tablet layout below 1024 px |
| QA-118 | X-002 | Confirmed | P3 | S | Same cause as QA-11 |
| QA-119 | X-006 | Confirmed | P3 | S | The auto-seeded empty vault trips the "pocket exists" guard |
| QA-120 | X-007 | Partial | P3 | M | Earlier rows are not adopted; the balance claim is wrong |
| QA-121 | QA-014 | Confirmed | P3 | S | Accounts truncates, Wealth rounds |
| QA-122 | QA-015 | Confirmed | P2 | S-M | Same cause as QA-13 |
| QA-123 | QA-016 | Confirmed | P3 | S | `no-scrollbar` is undefined in CSS |
| QA-124 | QA-031 | Already fixed | - | - | `CLAUDE.md` on main names the Frankfurt project |

## 6. Per-ticket evidence and fix plans

The sections below are the reviewers' full notes, one per ticket, grouped by area. Not verified anywhere: on-device behaviour, live user rows, Vercel environment values, and Supabase Auth settings.


## 6.1 P0 and P1

### QA-10 · E2E-001 · Email sign-up code length (8 sent, 6 accepted)
- **Verdict:** CONFIRMED · ticket P0 → my severity P0 · confidence high (code) / med (live config, not readable by SQL)
- **Evidence:** Every OTP entry in the app is hard-wired to 6 digits. `src/components/features/auth-modal/AuthOtpRow.tsx:22,33,59,66` slices to 6 and renders 6 boxes; `src/hooks/useAuthModal.ts:498-499` (sign-up, password reset, email 2FA all go through `verifyOtpCode`) refuses anything but 6; `src/components/auth/SecondFactorGate.tsx:61-62` same; `src/hooks/useOtpAutofill.ts:33` only matches `\d{6}`; admin portal `src/lib/server/admin/emailCode.ts:6,40` (`EMAIL_CODE_LENGTH = 6`) plus `StepUp.tsx:45`, `SignInScreen.tsx:94`, `SetupFlow.tsx:75`, `SecurityView.tsx:136`, and copy in `en.ts:2054-2096` / `EmailCodeInput.tsx:46`. There is no in-app email-change OTP (`updateUser({email})` is not called anywhere), and the biometric sign-in passes the minted token straight through with no length check (`src/lib/native/biometricAuth.ts:329`), so those two are not affected.
  Live config: the auth OTP length lives in GoTrue config, not in Postgres, so I could not read it. The ticket comments are consistent with the EU project (`tzioppxwsljhlglyducm`) having default auth settings since the Frankfurt move: admin sign-in mails an 8-digit code through our own mailer (`generateLink` → `email_otp`, 2026-11-18 16:58), and web + iOS sign-up received a link-only email in spam (Supabase's default "Confirm signup" template from Supabase's default sender), while Android received a 6-digit code (most likely an older build still on the Singapore project). Our own template for sign-up is code-only (`src/lib/email/defaults.ts:50-53`), so a link-only email means the Send Email hook (`src/app/api/auth/email-hook/route.ts`) is not active on the EU project.
- **Fix plan:**
  1. Owner, Supabase dashboard for "buddget - eu" (no code): (a) Authentication > Sign In / Providers > Email > "Email OTP length" = 6 (also check "Email OTP expiration"); (b) Authentication > Hooks > "Send Email" hook enabled, pointing at `https://<prod>/api/auth/email-hook`, and its secret copied to Vercel `SEND_EMAIL_HOOK_SECRET` (admin portal > Emails > Setup shows whether the env is set); (c) if the hook stays off, edit the "Confirm signup", "Magic link" and "Reset password" templates so they print `{{ .Token }}`; (d) custom SMTP / sender so mail stops landing in spam; (e) compare every other Auth setting with the Singapore project (Confirm email, secure email change, rate limits, redirect URLs).
  2. Code, make the length a single constant and tolerant: add `OTP_LENGTH` (one shared module, e.g. next to `AuthOtpRow`), accept 6 to 8 digits in `verifyOtpCode`, `SecondFactorGate.verify`, `verifyEmailCode` and the admin button guards; `AuthOtpRow` takes an optional `length` prop (default 6, additive, default look unchanged) and paste/autofill keeps up to 8 digits; `useOtpAutofill` matches `\d{6,8}`. Copy: drop "6-digit" from the strings or interpolate the constant (en + ar).
  3. No SQL migration.
  4. Test (fails before, passes after): `AuthOtpRow` unit test pasting an 8-digit code keeps all 8 with `length={8}`; `useAuthModal` test that an 8-digit `otp` reaches `supabase.auth.verifyOtp` unsliced; `emailCode` test that `verifyEmailCode` forwards an 8-digit token.
- **Effort / risk:** S for the dashboard change (it alone unblocks sign-up), M for the code tolerance · risk: the 6-box row layout at 8 boxes on 320px screens; iOS one-time-code autofill distribution.
- **Owner question:** Should email verification be code-only (what the app is built for) on every platform? If yes, do step 1; the "link" emails testers saw are a config regression, not a second supported path. Also confirm which Supabase project the current iOS and Android builds point at (the Android pass looks like the retired Singapore project).
- **Related:** the admin-portal comment on this ticket (8-digit admin code, sign-up mail not sent) is the same root cause (EU auth config reset) and is fixed by the same steps.

### QA-11 · E2E-002 · Money in / debt payments logged today miss the balance before 12:00 or on the opening day
- **Verdict:** CONFIRMED · ticket P1 → my severity P1 · confidence high
- **Evidence:** `instantOf` dates a row without `occurredAt` at local noon (`src/lib/accounts/balance.ts:40-43`) and `apply` drops rows with `at <= a.from || at > asOf` (`balance.ts:67`). `addExpense` stamps the time for today's rows (`src/lib/store/useFinanceStore.ts:278`), but `addIncomeEvent` (`:501-511`), `addIncomeWithDebt` (`:396-420`), `addDebtPaymentWithExpense` (`:815-852`, neither the payment nor its expense is stamped; the expense is the row the balance counts, `balance.ts:82-91`) and `addDebtPayment` (`:856-870`) do not, and none of their callers pass `occurredAt` (`IncomeSheetForm.tsx:183`, `AmountReceivedSheet.tsx:135`, `PaydayActionsCard.tsx:87`, `IncomePrompts.tsx:118`, `useAddDebtSheet.ts:618,639`, `recurringDebtDueHandlers.ts:120,125`, `aiActionHandlers.ts:608,733`, `buddgy/tools/exec/income.ts:220,563`, `debts.ts:632,635`). Result: before noon the row is "in the future" and appears at 12:00; on the day the account got its opening balance (set after noon) the row is treated as already inside the opening balance and never counts. The mappers already carry the column (`incomeEventMapper.ts:50`, `debtPaymentMapper.ts:23`, migration `0151`).
- **Fix plan:**
  1. `src/lib/store/useFinanceStore.ts`: stamp `occurredAt` exactly as `addExpense` does (`x.occurredAt ?? (date === localTodayISO() ? new Date().toISOString() : undefined)`) in `addIncomeEvent` (on `receivedDate`), `addIncomeWithDebt` (use `iso`), `addDebtPayment`, and in `addDebtPaymentWithExpense` for both the payment and the linked expense (one shared timestamp). Back-dated rows stay day-level, as today.
  2. Existing rows (15 live income events and the 5 debt payments have no `occurred_at`): optional read-side repair in `balance.ts`, no migration: when a row has no `occurredAt` and its `createdAt` falls on the same local day as its date, use `createdAt` as the instant. This counts same-day rows created after the opening instant and leaves the rest untouched.
  3. No SQL migration.
  4. Test (fails before, passes after): in `src/lib/accounts/__tests__/balance.test.ts` style, but through the real store (the fixture must not set `occurredAt` itself): set an opening balance at 14:00 today, call `addIncomeEvent` / `addDebtPaymentWithExpense` for today, assert `computeBalances` moved; second case with the clock at 09:00 asserts the row counts immediately.
- **Effort / risk:** S (step 1) + S (step 2) · risk for step 2: a user who already corrected the gap by hand ("What does your bank show now?" adjustment) would see the amount counted twice; step 1 alone has no regression risk.
- **Owner question:** Apply step 2 (auto-repair of existing same-day rows) or leave old rows and let testers re-enter/adjust?
- **Related:** QA-15 (the same `addDebtPaymentWithExpense` path; ship together so a Cash debt payment both syncs and reaches the balance).

### QA-12 · QA-001 · Budget Studio "saved right now" pocket doubles money already in accounts
- **Verdict:** CONFIRMED · ticket P1 → my severity P1 · confidence high
- **Evidence:** `commitFlowEntities` creates a savings pocket with `openingBalance: savings` whenever the answer is > 0 and the user has no pocket yet; the only guard is `store.savingsAccounts.length === 0` (`src/lib/budget/studioEntities.ts:58-63`). It never looks at tracked accounts. The question is only skipped when pockets already exist, because `liquidSavings` is computed from `savingsAccounts` only (`src/lib/budget/flow/known.ts:31`, `factsFromStore.ts:206`), so a user who entered Cash + bank balances in onboarding is still asked. Net worth then adds the accounts basis plus every pocket that is not flagged held (`src/lib/savings/netWorth.ts:59-60`, `src/lib/accounts/netWorthBasis.ts:14`); the studio pocket has no `heldInPaymentMethodId`, so the same money counts twice. Called from `StudioPage.tsx:130`; last touched in `f0c9215f`, not changed since the audit.
- **Fix plan:**
  1. `src/lib/budget/studioEntities.ts`: add `paymentMethods` to the `Actions` pick and skip the pocket when any account is tracked (`isTracked` from `src/lib/accounts/kinds`): the money the user describes is already on the balance sheet. The answer still drives the plan through `toFacts.ts:117` and is remembered in `budgetProfile`.
  2. `src/lib/budget/flow/known.ts` (optional, same change): when accounts are tracked, pre-fill `savingsOnHand` so the question is not asked at all; needs the owner's answer below.
  3. Repair of live data: no automatic migration (only the owner's pocket provably duplicates account money; the other 12 unlinked "Opening balance" deposits may be real separate savings). Owner deletes the duplicate pocket by hand, or a one-off prompt asks affected users.
  4. No SQL migration.
  5. Test (fails before, passes after): `studioEntities` test: store with a tracked account and no pockets, `a.savingsOnHand = 1400` → `addSavingsAccount` not called and `created.savings` undefined; existing "no accounts tracked" case still creates the pocket.
- **Effort / risk:** S · risk: a user with tracked accounts who really holds extra savings elsewhere no longer gets a pocket from the studio (they can add one in Wealth).
- **Owner question:** When the user already tracks account balances, should "How much do you have saved right now?" (a) still be asked but create nothing [smallest fix], (b) be skipped and answered from the account balances, or (c) create the pocket as an earmark inside an account the user picks?
- **Related:** QA-13 (same double-count mechanism, different entry point; see there). Symptoms QA-002 / QA-007 folded into this ticket follow from the duplicate pocket.

### QA-13 · QA-013 · Pocket "from an account you already have" counted on top of the account
- **Verdict:** CONFIRMED · ticket P1 → my severity P1 · confidence high
- **Evidence:** `PocketFormSheet.create` saves only `linkedPaymentMethodId` (`src/components/features/savings-v3/PocketFormSheet.tsx:71-83`, opened with the chosen method from `AddHoldingSheet.tsx:71,175-181`). Every money reader keys on the other field, `heldInPaymentMethodId`: `netWorthBasis.ts:14`, `balance.ts:115,131` (held/free), `zakatAccounts.ts:15`, `accountLeg.ts:21`, `MoveMoneySheet.tsx:50`. `linkedPaymentMethodId` on a pocket is read in one place only, to label the chip (`AddHoldingSheet.tsx:64`). And nothing in `src/` ever writes `heldInPaymentMethodId` (only tests, the mapper and the import schema mention it), so the "earmark inside an account" model that the engine and its tests implement cannot be reached from the UI. The pocket's "What's in it now" is therefore added to net worth, zakat and Buddgy on top of the account, and the account's "free" does not shrink.
- **Fix plan:**
  1. `PocketFormSheet.tsx` `create`: when `linkedMethod` is a tracked account (`isTracked`) in the pocket's currency, also set `heldInPaymentMethodId: linkedMethod.id`. That one field makes net worth skip the pocket, shrinks the account's free amount (fixes the folded-in QA-018 "350 free" offer) and fixes zakat. Cap the opening amount at the account's free balance (reuse the `moreThanFree` message pattern from `MoveMoneySheet`).
  2. Repair of the 3 live linked-not-held pockets: one data migration, `UPDATE savings_accounts SET held_in_payment_method_id = linked_payment_method_id WHERE held_in_payment_method_id IS NULL AND linked_payment_method_id IS NOT NULL AND <linked method has opening_balance> AND currency matches` (SELECT the rows first; 3 expected). The row-version stamp makes devices pull it.
  3. Test (fails before, passes after): store test creating a pocket through the same payload the sheet sends (`linkedPaymentMethodId` + new field) with a tracked account, then `accountsBasisFor` + `computeNetWorth`: net worth unchanged, `free` reduced by the pocket balance. Add a component test that the sheet's payload carries `heldInPaymentMethodId`.
- **Effort / risk:** S-M · risk: this is the first time held pockets exist in production, so two engine gaps become reachable and should be covered in the same change: (a) a deposit into a held pocket from a different account lowers that account while the pocket is excluded from net worth (`balance.ts:115` only skips the leg when it is the holding account), (b) `accountsBasisFor` does not exclude pockets held in an excluded account while `zakatAccounts.ts:15` does.
- **Owner question:** Is a pocket created "from an account you already have" meant to be an earmark inside that account (money stays in the account, free shrinks) [what the engine was built for], or a transfer out of it (account drops by the amount)? The fix above assumes earmark.
- **Related:** QA-12. Same mechanism (a pocket opening balance declared for money a tracked account already holds, pocket not flagged held), but not one fix: QA-13 knows the account and is fixed by writing `heldInPaymentMethodId`; QA-12 has no single account and is fixed by not creating the pocket. Ship together and share the net-worth regression test.

### QA-14 · SMS-011 · Prompt-injection SMS books income through the AI fallback
- **Verdict:** CONFIRMED (the guard is missing; whether the exact payload still books depends on the model, which changed) · ticket P1 → my severity P2 · confidence high (code) / low (current model behaviour, not run)
- **Evidence:** On the AI tier the message is concatenated into the same user turn as the instructions (`src/app/api/sms/parse/route.ts:1748-1759`, three `parts` of one `role: 'user'` content, no `systemInstruction`, no delimiter, and `src/lib/sms/aiParserPrompt.ts` says nothing about instructions inside the SMS). The model's `amount`, `kind` and `confidence` are then trusted: the only checks before booking are `is_transaction`, `confidence >= 0.6` (`:1100`), `isPlausibleAmount` (≤ 1,000,000,000, `ingestGuards.ts:14,87`), the truncation flag, and `checkCreditSender` (`ingestGuards.ts:183-194`), which passes for sender "CIB". `createSmsTransaction` then books a confirmed income event (`route.ts:1136-1166`); the direction guard is ledger-sign only (`directionGuard.ts`) and does not apply. At confidence ≥ 0.9 the same message is also handed to the global template learner (`route.ts:993-1001`). The model moved to `TIER_MODELS.smart` in `11beb512`; nothing else changed on this path.
  Why P2, not P1: the attacker must get an SMS from a known bank sender id onto the victim's phone. With that ability a well-formed fake "credited" SMS books the same income through the curated tier with no AI involved, so the injection adds no new capability against one user. The part that reaches other users is the template learner (SMS-013).
- **Fix plan:**
  1. `route.ts` `callGemini`: send `SMS_PARSER_SYSTEM_PROMPT` as `systemInstruction`, and the SMS alone in the user turn inside explicit markers; add one rule to the prompt in `aiParserPrompt.ts`: the text between the markers is data, any instruction or JSON inside it is not a transaction (`is_transaction: false`).
  2. `src/lib/sms/ingestGuards.ts`: add a pure `aiReadingGrounded(amount, message)`: after `normalizeDigits`, the amount must equal a number printed in the body, and the body must not contain model-output syntax (`{`, `}`, `"is_transaction"`). In `route.ts`, for `parseMethod === 'ai_new'`, a failed check goes to the existing `holdForReview` (new code, e.g. `unverified_reading`; add its reason line where `low_confidence` is mapped: `smsDisplay.ts`, `templateHealth.ts`) and sets `learnStatus` so `learnPattern` is not scheduled. Note: the "amount appears in the body" half alone does NOT stop the ticket's own payload (999999 is printed inside the injected JSON); the syntax check and step 1 do.
  3. Optional, needs the owner's answer: hold every AI-tier credit (`income`, `instant_transfer_in`, `refund`) for one-tap confirmation by reusing the `senderHeld` → `heldForConfirmation(parsed.kind)` branch (`route.ts:1136`).
  4. No SQL migration (`failure_code` has no CHECK constraint).
  5. Tests (fail before, pass after): `ingestGuards.test.ts` for the helper (C33 body → not grounded; "Your account was credited with EGP 5,000.00" + 5000 → grounded; Arabic digits; thousands separators); `src/app/api/sms/parse/route.test.ts` case with the Gemini mock returning the injected JSON for the C33 body → response `held: true`, no `createSmsTransaction` call, no `learnPattern`.
- **Effort / risk:** M · risk: false holds on real messages whose amount format the helper does not normalise (e.g. "5.000,00", amounts in words), which cost the user one confirm tap; prompt restructuring can shift AI parse quality, so run the existing SMS corpus tests and re-run corpus case C33 against the live model.
- **Owner question:** Should income / incoming-transfer / refund read by the AI tier (no curated or learned template yet) wait for a one-tap confirmation instead of booking at once? (a) yes, always; (b) only when the deterministic check in step 2 fails [my recommendation]; (c) never.
- **Related:** SMS-013 (injected message learned as a template; step 2 must also block learning), SMS-006, NAT-012 (as named in the ticket).

### QA-15 · SYNC-001 · Debt payment from Cash sent with payment_method_id "pm_default_cash"
- **Verdict:** CONFIRMED · ticket P1 → my severity P1 · confidence high
- **Evidence:** `debtPaymentToRow` writes `payment_method_id: p.paymentMethodId ?? null` (`src/lib/supabase/remote/mappers/debtPaymentMapper.ts:10`); it is the only mapper with a payment-method FK that can receive the in-store Cash sentinel and does not null-map it (`expenseMapper.ts:23-24`, `incomeEventMapper`, `incomeSourceMapper`, `receiptMapper`, `subscriptionMapper`, `recurringExpenseMapper`, `recurringDebtPaymentMapper` all compare with `DEFAULT_CASH_ID`). The comment at `src/lib/supabase/remote/sync.ts:332-335` still claims the debt-payment mapper does. The sentinel reaches it from the pay-debt sheet (`src/hooks/useAddDebtSheet.ts:616-648`, `pmId` falls back to the default method, which is `pm_default_cash` while Cash is not a tracked account, or to `''`), the recurring-due handler (`recurringDebtDueHandlers.ts:105-125`) and Buddgy (`buddgy/tools/exec/debts.ts:620-635`). A non-uuid (or empty string) in a uuid column is 22P02, the row is parked, and the linked expense then fails its FK (23503). The tester's screenshot on this ticket (2026-11-18, "2 items can't be saved to the cloud and were set aside" after paying a new debt) is this bug on production: the 2 items are the payment and its expense. Not changed since the audit (last commit on the mapper: `5c3cdb8e`).
- **Fix plan:**
  1. `debtPaymentMapper.ts`: `payment_method_id: p.paymentMethodId && p.paymentMethodId !== DEFAULT_CASH_ID ? p.paymentMethodId : null` (same expression as `expenseMapper.ts:23-24`; also covers `''`). In `debtPaymentFromRow` map `null` back to `DEFAULT_CASH_ID` like `expenseMapper.ts:60`, so the row round-trips unchanged and is not re-sent as an edit after every pull.
  2. No SQL migration.
  3. Test (fails before, passes after) in `debtPaymentMapper.test.ts`: `debtPaymentToRow({ ...payment, paymentMethodId: 'pm_default_cash' })` and `''` → `payment_method_id === null`; round trip returns `DEFAULT_CASH_ID`. Per the project's "test the real shape" rule add one store-level test: `addDebtPaymentWithExpense` with the sentinel → `flushDiff` rows carry `null`.
  4. Ship with QA-16 plus the one-time re-send described there; without it, devices that already recorded these rows as delivered never send them.
- **Effort / risk:** S · risk: with the from-row change, a payment that has no linked expense and a NULL method on the server (card payoffs, Buddgy/AI-entered payments, money collected) now resolves to the Cash account in `balance.ts:101-108` once Cash is tracked; only 5 `debt_payments` rows exist, check them before shipping. If that is not wanted, keep `undefined` on read and accept a one-off re-upsert.
- **Related:** QA-16 (must ship together), QA-11 (same store action), QA-40 and QA-50 (linked, with another reviewer). The ticket says it includes QA-030.

### QA-16 · SYNC-002 · Parked rows recorded as delivered, never retried
- **Verdict:** CONFIRMED · ticket P1 → my severity P1 · confidence high
- **Evidence:** `flush()` does hold parked rows out of the baseline (`src/components/sync/SupabaseFinanceSync.ts:338-342`, `holdParkedBack` in `src/lib/supabase/remote/parkedRows.ts`) but returns `!result.anyError`, which is `true` when rows were only parked (`:350`; parked rows are not in `errors`, `sync.ts:148-161,229`). Every reconcile then replaces that baseline with the whole store: `prevSnap.current = baselineAfterFlush(prevSnap.current, snapshot(useFinanceStore.getState()), flushed)` followed by `persistBaseline` (`SupabaseFinanceSync.ts:396-399`; `flushBaseline.ts:4-6` returns `current` when `flushed`). Reconcile runs at mount, reconnect, resume, pull-to-refresh and realtime nudges, so within one cycle the parked rows' hashes are in `buddget:flushed:<uid>`, the next diff no longer contains them, `recordSetAside([])` clears the banner (`:332`), and nothing retries. The rows stay in the local store (the merge is a union), so the loss shows on reinstall or a second device. The ticket is in "Failed QA" with no comment; code at HEAD is unchanged on these lines (`git blame`: 2026-10-27 and 2026-11-05), so nothing was fixed.
- **Fix plan:**
  1. `SupabaseFinanceSync.ts`: keep the last flush's parked list in the effect closure (`let parkedNow: ParkedRow[]`, set where `recordSetAside` is called). In `pendingSync`, when `flushed`, compute the new baseline as `holdParkedBack(snapshot(store), prevSnap.current, parkedNow)` instead of the raw snapshot (reuses the existing helper; `prevSnap.current` at that point is already the held-back baseline). Parked rows then stay "unsent", are offered on every later flush and at the next start, and the banner stays up while they exist.
  2. One-time re-send for devices that already recorded parked rows as delivered: a versioned local flag (`buddget:resend:v1:<uid>`); on the first boot after the upgrade drop `debtPayments`, and expenses with `linkedDebtPaymentId`, from the boot baseline (`baselineForBoot` in `flushedFingerprint.ts`) so the first flush upserts them again. Upserts are idempotent by id and the stale-write guard keeps newer server copies. Scope is deliberately the only known rejection (QA-15); it is a handful of rows per device.
  3. No SQL migration.
  4. Tests (fail before, pass after): `flushBaseline.test.ts` / `financeSync.test.ts`: flush returns one parked row, then a reconcile runs → the baseline does not contain the row and the following `flushDiff` offers it again; boot test for step 2: fingerprint contains a debt payment → first flush still upserts it once, second boot does not.
- **Effort / risk:** M · risk: a row the server will never accept is retried on every flush (one small failing request each time) until it is edited; bounded by the number of parked rows, and the banner tells the user. The re-send in step 2 must run after QA-15's mapper fix is in the same build, or it parks the same rows again.
- **Related:** QA-15 (ship together), QA-40 and QA-50 (linked, with another reviewer: presumably the banner/outbox side). Any other rejected row class (the ticket names SYNC-003 and schema drift) is lost the same way until step 1 ships.


## 6.2 Database and API

### QA-17 · DB-001 · Every API rate limit allows about twice its configured rate
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high
- **Evidence:** Live `public.api_rate_hit(text,int,int)` (read from `pg_proc` today) still computes `date_trunc('second', now()) - make_interval(secs => mod(extract(epoch from now())::int, p_window_seconds))`; same text in `supabase/migrations/0215_b8_db_performance.sql:43` (and `0206...:104`). `::int` rounds, so a call at T.2 lands in bucket `floor(T/W)*W` and a call at T.7 lands in that bucket minus one second: two counters per window, each allowed `p_max_hits`. It is the only live function with this expression (`prosrc` search returned one row). `admin_rate_hit` already uses the correct formula (`0126_admin_rate_hit.sql:13`). Every limiter goes through it (`src/lib/server/rateLimit.ts:7`, `publicApiRateLimit.ts:44`, about 30 call sites incl. biometric sign-in, check-email, AI per-user and `ai-grounded` per-day cap, account delete).
- **Fix plan:**
  1. New migration `0318_api_rate_hit_bucket.sql`: `CREATE OR REPLACE FUNCTION public.api_rate_hit` with the same signature, security definer and search_path, changing only the bucket line to the one `admin_rate_hit` uses: `to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)`. Re-state the grants per 0315 (`revoke ... from public, anon, authenticated; grant execute ... to service_role`); live grants today are service_role only.
  2. In the same file, a `DO $$ ... ASSERT` block (the pattern 0215 uses): the formula gives the same bucket for `...:00.2` and `...:00.7` of one second, and `pg_get_functiondef` no longer contains `::int, p_window_seconds`. `now()` is fixed inside a transaction, so the two-call test from the ticket cannot run inside the migration; the assertion on the expression is the before/after check. No repo SQL test harness exists (`supabase/` has only `migrations/`).
  3. Apply with `execute_sql`, no types regeneration needed (signature unchanged). Old half-shifted buckets simply expire (hourly `api-rate-cleanup` cron).
- **Effort / risk:** S · Limits become twice as strict as users experience today (they become what the code says). Check nobody relies on the slack: `ai-grounded` per-day cap and `bio-signin-dev` 10/10 min are the tight ones.
- **Related:** QA-54 (biometric limit), QA-52 (new limit would use this function).

### QA-51 · API-001 · A JSON null body or a wrong-typed field gives an unhandled 500
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** A body of literal `null` parses fine and is then dereferenced: `src/app/api/ai/route.ts:97-100` (destructures `body`, caught by the outer catch → 500 "Failed to process AI request"), `src/app/api/analytics/onboarding/route.ts:19-23` (`body.type`, no catch → empty 500), `src/app/api/billing/paywall-view/route.ts:15-16` (`.catch(() => ({}))` only covers invalid JSON; `body.platform` throws, billing is on live), `src/app/api/budget/ai/route.ts:123,128` (`body.op`). Wrong-typed fields: `auth/check-email/route.ts:47-48` (`body?.email?.trim()` with a number → 500 "Unexpected failure"), `biometric/signin/route.ts:22-23` (`secret`), `biometric/register/route.ts:25-26` (`secret_hash`). All other body-reading routes go through zod `safeParse` or an `isRecord` check (`buddgy/turn`, `voice/transcribe` uses `body?.audio`) and return 400. `webhooks/linear` and `webhooks/resend` have the same null deref but only after a valid signature, so not reachable from outside.
- **Fix plan:**
  1. In the four null-body routes add one guard right after the parse: `if (typeof body !== 'object' || body === null || Array.isArray(body)) return 400` with that route's existing invalid-body message (`'Invalid request payload'` in `ai`, `'Invalid request'` in `analytics/onboarding` and `budget/ai`; in `paywall-view` fall back to `{}` like the existing catch does).
  2. In `auth/check-email`, `biometric/signin`, `biometric/register` change the read to `typeof body?.x === 'string' ? body.x.trim() : ''` so the existing 400 branch handles it.
  3. No migration. Tests: add one case per route to the existing `route.test.ts` files (`ai`, `budget/ai`, `biometric/signin` have them; add small ones for `analytics/onboarding` and `paywall-view`): body `null` (and a numeric field) → 400, fails today with 500 / a thrown TypeError.
- **Effort / risk:** S · None beyond status code changing from 500 to 400.
- **Related:** QA-55 (the empty-body 500s it lists are these), QA-52 (same file).

### QA-52 · API-002 · paywall-view records anything, without limit
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `src/app/api/billing/paywall-view/route.ts:8-19` checks only an active session and the billing switch, then calls `record_paywall_view` for every request; no `isRateLimited`, no dedupe. Body validation is partly there on the DB side: the live function keeps `platform` only if it is ios/android/web and truncates `source` to 40 chars (`0295_s6_measurement.sql:23`), so the only real gap is volume. `paywall_views` also has no retention (not in `db_retention`, only created in 0295), so any signed-in user can grow it and inflate `paywallViewsPerDay` / `ByCountry` (`0297_s6_v2_server.sql:124-125`). The app itself sends one call per `PlansView` mount (`PlansView.tsx:59-61`).
- **Fix plan:**
  1. In the route, after the billing check: `if (await isRateLimited(service, \`paywall-view:${identity.id}\`, 3600, 20, true)) return NextResponse.json({ ok: true, recorded: false })` (reuse `isRateLimited` from `src/lib/server/rateLimit.ts`; fail open so a counter blip never errors the paywall).
  2. Optional, same change: add `DELETE FROM public.paywall_views WHERE viewed_at < now() - interval '400 days'` to `db_retention()` in a migration (project rule: no event table without a purge). `paywall_views_day_idx` on `viewed_at` already supports it.
  3. Test: new `paywall-view/route.test.ts`: 21st call in the hour returns `recorded:false` and `rpc('record_paywall_view')` is not called; fails today.
- **Effort / risk:** S · A user who opens the plans screen more than 20 times an hour is under-counted (intended).
- **Related:** QA-51 (null body 500 in the same route), QA-17 (the limiter itself is 2x loose until fixed).

### QA-53 · API-003 · A deleted account's JWT still gets 200s, and its writes are dropped without an error
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high (behaviour is a documented trade-off)
- **Evidence:** `resolveRouteIdentity` verifies the JWT locally and never asks Auth (`src/lib/supabase/resolveRouteUser.ts:82-100`, comment says so on purpose); `resolveApiUserId` is a thin wrapper (`src/lib/auth/resolveApiUser.ts:5-7`). Routes on it accept a deleted user's token until it expires: `notifications`, `entitlements/me`, `flags`, `support/board`, `support/tickets`, `support/submit`, `feedback`, `analytics/onboarding`, `devices`. The paid/SMS/push routes already use the `isAccountActive` variants (60 s cached Auth lookup, `src/lib/auth/accountActive.ts`). Reads return empty data, so no leak. The part worth fixing is writes with outside effects: `feedback/route.ts:23-24` can still create Linear issues (5/hour) and `support/submit/route.ts:35,58` still calls `support_submit` for a user that no longer exists; `analytics/onboarding/route.ts:35` ignores the insert error and answers `{ok:true}`.
- **Fix plan:**
  1. Swap to the existing active-account resolver only on the routes that create something: `feedback` (`resolveRouteIdentity` → `resolveActiveApiIdentity`), `support/submit`, `support/tickets/[number]` reply, `support/board/[number]/vote` (`resolveApiUserId` → `resolveActiveApiUserId`). They are low-volume, so the one Auth lookup per user per minute costs nothing.
  2. Leave the read routes (`notifications`, `entitlements/me`, `flags`) on the local check: they run on every app open and an Auth lookup there is exactly the DB load the local verification was introduced to avoid.
  3. `analytics/onboarding`: no change needed (the dropped row is correct); optional `if (error) return { ok: true, dropped: true }` for honesty.
  4. No migration. Test: extend `src/app/api/suspendedAccount.test.ts` (it already covers the active-gated routes) with `feedback` and `support/submit` → 401 for a deleted/banned id; fails today.
- **Effort / risk:** S · A suspended (not deleted) user also loses the ability to file a support ticket from the app; confirm that is wanted (see question).
- **Owner question:** Should a suspended account still be able to send a support ticket from inside the app? If yes, gate only `feedback`/vote and leave `support/submit` + reply as they are.
- **Related:** SEC-003 (same root: local JWT check), QA-55.

### QA-54 · API-004 · The biometric/signin per-device limit is keyed on a random id when the header is missing
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `src/lib/auth/resolveDeviceId.ts:11-20` returns the header id, else the cookie, else mints `randomUUID()` and sets a cookie. `src/app/api/biometric/signin/route.ts:26-34` uses that id for `bio-signin-dev:<id>` and runs the device check before the IP check, so a request with no header and no cookie always writes a fresh one-hit `api_rate_limits` row, even after the IP is already limited (the `||` evaluates the device limiter first). No security bypass: a freshly minted id can never match a `biometric_devices` row (line 37-46 → 404), and guessing a real device's secret requires sending that device's id, which is limited properly. Cost is junk rows (cleaned hourly by `api-rate-cleanup`) and one pointless lookup per request, bounded by 40/10 min per IP (80 until QA-17).
- **Fix plan:**
  1. In `biometric/signin/route.ts` check the per-IP limit first.
  2. Do not mint: read the id directly (`request.headers.get(DEVICE_ID_HEADER)` validated with `DEVICE_ID_PATTERN`, else `readDeviceCookie()` from `src/lib/auth/deviceCookie.ts`); if there is none, return the existing 404 `'No biometric account on this device'` without touching the device limiter or the table. Leave `resolveDeviceId` itself unchanged (2FA trusted-device flows rely on the minting).
  3. No migration. Test in the existing `biometric/signin/route.test.ts`: request with no header/cookie → 404, `api_rate_hit` called once (IP key only), no `Set-Cookie`; fails today (two limiter calls, cookie set).
- **Effort / risk:** S · The native client always sends the header (`src/lib/native/deviceId.ts:20`, `biometricAuth.ts:314`); verify the test covers the web cookie path so it is not broken.
- **Related:** QA-17.

### QA-55 · API-005 · Inconsistent error shapes and status codes across API routes
- **Verdict:** PARTIAL · ticket P3 → my severity P3 (cosmetic) · confidence high
- **Evidence:** The wording differs (`'Not authenticated'` 24 occurrences, `'Unauthorized'` 34, `'Sign in to continue.'` in `auth/welcome/route.ts:15`), but the shape is the same everywhere: `{ error: string }` with status 401; the AI routes add an optional `stage` (`src/lib/server/ai/auth.ts:14`) that the client reads only for `'quota'`. No client code compares the 401 text: every caller branches on `res.status` (`changePassword.ts:25`, `runTurn.ts:62`, `transcribeAudio.ts:71`, `smsTracker.ts:232`, `budgetAiClient.ts:16`, `usePendingAiJobs.ts:45`). Empty-body 405s are the Next.js default for a method a route does not export; the app never sends those. The empty-body 500s are QA-51.
- **Fix plan:**
  1. Fix QA-51 (removes the empty 500s). Then close this ticket.
  2. Not recommended now: unifying ~58 strings touches ~45 route files and their tests for no behaviour change. If wanted later, do it as its own pass with one `unauthorized()` helper next to `src/lib/server/rateLimit.ts`.
- **Effort / risk:** S if closed with QA-51 · M and wide test churn if the strings are unified.
- **Related:** QA-51.

### QA-56 · API-006 · /api/health/deep is public and describes internal state
- **Verdict:** NOT-A-BUG · ticket P3 → my severity none (optional hardening) · confidence med
- **Evidence:** The facts are right: `src/app/api/health/deep/route.ts:42-50` has no auth and returns `buildInfo()` (version, 7-char commit, region) plus cron/outbox flags and counts from `evaluateCronHealth` (`src/lib/server/cronHealth.ts:25-45`). It is public on purpose and documented as such: route comment ("Readiness for a monitor and the portal ... Reports status only, never data"), `docs/ADMIN_PLATFORM_MASTER_PLAN.md:114` and `docs/ADMIN_PORTAL.md:25` ("rate limited, no secrets"), `buildInfo.ts:9` ("the commit is public to anyone who can see the repo"). The shallow `/api/health` exposes the same commit and region. The answer is cached 60 s for all callers, so it cannot load the DB. Nothing in `src/` fetches the deep route, so gating it would only affect an external monitor.
- **Effort / risk:** n/a (if hardening is chosen: S; reuse `isAuthorizedCron` from `src/lib/server/cronAuth.ts`, return only `{ ok, degraded }` to callers without the bearer, full body with it; an external monitor would need the header).
- **Owner question:** Is an external uptime monitor polling `/api/health/deep` without credentials? (a) Yes / not sure → leave as is and close. (b) No → trim the public answer to `{ok, degraded}` and require `Bearer CRON_SECRET` for the detail.
- **Related:** QA-57 (its stuck row is what makes this endpoint say `degraded:true`).

### QA-57 · API-007 · The Linear integration outbox never drains in production
- **Verdict:** UNSURE · ticket P3 → my severity P3 · confidence med (symptom confirmed live, cause is deployment config I cannot read)
- **Evidence:** Live today (2026-11-18): `integration_outbox` still has exactly one row, `linear.issue`, `pending`, `attempts 0`, created 2026-11-14 02:26. `attempts` is incremented by the claim itself (`integration_outbox_claim`, live definition), so nothing has ever claimed it. `service_role` has EXECUTE on the claim function and the notifications cron ran today, so the DB side is fine. The only code path that skips the claim is `if (!apiKey) return 0` (`src/lib/server/integrations/outbox.ts:12`); `cron/integrations/route.ts:14-15` then still answers `{ ok: true, sent: 0 }`. So either `LINEAR_API_KEY` is not set in Vercel production or the Vercel cron for `/api/cron/integrations` is not firing; I cannot read Vercel env or cron logs. `docs/ADMIN_PLATFORM_REVIEW.md:71` lists adding that key as an open owner step. Note: the "Linear bot is inactive" project rule is about `scripts/linear-bot.sh` (the release bot); this outbox is the in-app support form → Linear escalation (`support/submit/route.ts:79`, `HelpCard.tsx:50`) and is still wired. Side effect while the row sits: `health/deep` reports `outbox_backlog` and `degraded:true` permanently (`cronHealth.ts:8,34`), which hides real degradations.
- **Fix plan:**
  1. Owner checks Admin portal → Platform → services: "Linear (feedback intake)" (`src/app/api/admin/platform/route.ts:66`) shows whether the key is present. If missing and escalation is wanted: add `LINEAR_API_KEY` in Vercel production and redeploy; the next 05:30 cron sends the row. No code change.
  2. If escalation to Linear is not wanted now: mark the one stuck row `dead`/delete it (owner-approved one-row write) and leave the code; bug tickets still land in `support_tickets`.
  3. Small code change either way (optional): in `cron/integrations/route.ts` return `{ ok: false, reason: 'linear_not_configured' }` with 503 when the key is unset, so the missing key shows in cron logs instead of a silent `sent: 0`. Test: route test with the env unset expects 503; today it gets 200.
- **Effort / risk:** S · Setting the key makes real Linear issues appear for every auto-triaged bug report.
- **Owner question:** Do you want in-app bug reports to create Linear issues right now? (a) Yes → set `LINEAR_API_KEY` in Vercel production. (b) No → I clear the one stuck row so health stops reporting degraded, and optionally stop queueing until the key exists.
- **Related:** QA-56.

### QA-58 · API-008 · Admin website-leads pagination can repeat or skip rows
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `src/app/api/admin/leads/route.ts:19-21` pages with `.order('created_at', { ascending: false }).range(offset, offset + 199)` and returns `nextOffset`; `LeadsView.tsx:28-33` appends the next page without de-duplicating by id. A lead inserted between two page loads shifts every offset by one, so the last row of page 1 repeats at the top of page 2; equal `created_at` values have no tie-break. `admin/audit` uses an id cursor (`audit/route.ts:13-16`). Impact is small: admin-only, needs more than 200 leads (rows expire after 180 days, intake is rate limited per IP, per email and per day).
- **Fix plan:**
  1. Route: replace `offset` with a `cursor` param of the form `<created_at ISO>|<id>`; order by `created_at desc, id desc`, `.limit(200)`, and when a cursor is present add `.or(\`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})\`)` after validating `ts` with `Date.parse` and `id` as a uuid. Return `nextCursor` built from the last row (null when fewer than 200).
  2. `LeadsView.tsx`: rename `nextOffset`/`offset` to `nextCursor`/`cursor` (state shape unchanged otherwise). Reuses the same `DataTable`, `useAdminQuery`, `adminFetch`.
  3. No migration: `site_leads_created_at_idx (created_at desc)` already serves the query; the table is tiny so the `id` tie-break needs no extra index.
  4. Test in the existing `admin/leads/route.test.ts`: a request with a cursor applies the `or` filter and no `range`; response carries `nextCursor`. Fails today.
- **Effort / risk:** S · An admin tab open during deploy holds an old `nextOffset`; the new route ignores `offset` and returns page 1 again (harmless).

### QA-59 · API-009 · trial_claims keeps the plaintext email after account deletion
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `trial_claims.email_key` is the primary key and holds the normalised address in clear (`0292_s6_trial_and_sms_cap.sql:8-12`), written by the live `trial_claim` function from `normalizeEmailKey(user.email)` (`src/app/api/entitlements/trial/route.ts:25-28`, `src/lib/entitlements/trial.ts:6-15`). `user_id` is `ON DELETE SET NULL`, so the row survives deletion by design (one trial per mailbox, `docs/launch/S5c-review.md:284`). Nothing reads the value as an email: the only readers are the `on conflict (email_key)` uniqueness check, the daily count in `trial_claim`, and `admin_trial_grants_daily`. The table is service-role only (0292:14-15, 0316:76-77), so exposure is to staff/DB access, not to users.
- **Fix plan:**
  1. Migration `03xx_trial_claims_hashed_key.sql`: inside `trial_claim`, derive `v_key := encode(extensions.digest(p_email_key, 'sha256'), 'hex')` and use `v_key` for the insert/conflict; in the same migration `UPDATE public.trial_claims SET email_key = encode(extensions.digest(email_key, 'sha256'), 'hex') WHERE email_key LIKE '%@%'` (run `SELECT count(*)` first; the table is at most a few hundred rows; safe to run again because hashed keys contain no `@`). Confirm `pgcrypto` is installed in `extensions` first (`list_extensions`). Keep the function's grants as 0315 set them (service_role only).
  2. No app code change (the route keeps sending the normalised address; the hash happens in the DB), no types change.
  3. Test: the route test (`entitlements/trial/route.test.ts:38`) is unchanged. Add an `ASSERT` block in the migration: no row with `@` remains, and a second `trial_claim` for an already-claimed address still returns `already_claimed`.
  4. Stronger variant if wanted: HMAC with a server-side pepper computed in the route (new env var + a one-off backfill script). A plain SHA-256 stops casual reading and bulk export but can be confirmed by anyone who already knows the address.
- **Effort / risk:** S · If the backfill and the function change are not applied together, already-claimed users could claim a second trial; do both in one transaction.
- **Owner question:** Plain SHA-256 in the database (one migration, no new secret) or peppered HMAC (new env var, backfill script)? I recommend the plain hash now.

### QA-60 · DB-002 · 'NaN' passes every money check and corrupts balances
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** Live `deposit_to_savings_v2` / `withdraw_from_savings_v2` guard with `p_amount IS NULL OR p_amount <= 0`, and `correct_savings_balance_v2` with `p_new_balance < 0`; numeric NaN sorts above every number so all three pass. The existing table checks are plain `amount > 0` (`expenses_amount_pos`, `income_events_amount_pos`, `debt_payments_amount_pos`), and `savings_transactions` / `savings_accounts` have no money CHECK at all. Only `asset_prices_price_positive` excludes NaN (`0254_asset_prices_price_positive.sql:4`). The RPC is not the main door: the app does not call the v2 RPCs (no `.rpc('...savings...')` in `src/`; `0198_savings_rpc_v2.sql:9`), it writes rows through the `*_insert_own` / `*_update_own` RLS policies, so a hand-made PostgREST call with `"NaN"` reaches the tables directly. The app itself cannot send it (`JSON.stringify(NaN)` is `null`). Beyond the user's own data, one NaN row turns any cross-user `SUM` (admin metrics) into NaN. `income_events.amount` and 35 other numeric columns have no precision, so `'Infinity'` passes `> 0` there as well. I did not scan user tables for existing NaN rows (not allowed here).
- **Fix plan:**
  1. Before writing the migration, run one bounded count per table for existing bad rows (the audit's synthetic `qa-api-1` pocket may still hold NaN): `SELECT count(*) FROM <t> WHERE <col> = 'NaN'` on `savings_accounts`, `savings_transactions`, `expenses`, `income_events`, `debt_payments`; repair or delete what it finds.
  2. Migration: an upper bound rejects NaN and Infinity in one comparison, so replace/add checks as `NOT VALID` then `VALIDATE`: `expenses`, `income_events`, `debt_payments`: `amount > 0 AND amount < 1e16`; `savings_transactions`: `amount >= 0 AND amount < 1e16`, `balance_after IS NULL OR (balance_after > -1e16 AND balance_after < 1e16)`; `savings_accounts`: same range on `current_balance` and `opening_balance`. Follow the existing `0204_b3_constraints_not_valid.sql` pattern.
  3. Same migration: in the three v2 RPCs change the guard to `p_amount IS NULL OR NOT (p_amount > 0 AND p_amount < 1e16)` (and the balance equivalent), keeping grants as 0315 set them (authenticated + service_role).
  4. Test: `ASSERT` block in the migration that an insert of `'NaN'` into each table inside a sub-transaction raises `check_violation`. No app code or types change.
- **Effort / risk:** M (step 1 and validating constraints on live tables need care) · A legitimate value ≥ 1e16 would be refused (not realistic); `VALIDATE` fails if step 1 missed a bad row.
- **Related:** QA-62 (same RPCs, same "the table is the real door" point; ship in one migration).

### QA-61 · DB-003 · The migration ledger no longer matches the repo (unrecorded files, 0298 number collision)
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** As of today: 303 `.sql` files in `supabase/migrations/` at HEAD, 277 rows in `supabase_migrations.schema_migrations`. Matching by name (exact, or ignoring the numeric prefix): 237 files are recorded, **66 are not** (ticket said 70). The 66: legacy pre-renumbering files `001`-`007`, `0035`, `0039`, `0040`, `0042`-`0045`, `0050`, `0058`, `0062`, `0065_drop_push_subscriptions`, `0077`, `0078`; then `0097_savings_vault_and_default_carry`, `0111`, `0163`, `0172`, `0173`, `0176`, `0230`; the block `0240`-`0282` (39 files; `0252_p3_data_repairs_NOT_APPLIED` is unapplied on purpose); and `0300`, `0301`, `0302`. 41 ledger names have no file (the original `0001`-`0025` set and a few renamed ones). Spot check of 8 objects from unrecorded files (`expenses.edited_at`, `expenses.server_rev`, `savings_month_summary.carry_settled_at`, `sms_parse_log_zero_variance_idx`, `ai_usage_events_user_cover_idx`, `ai_credit_windows`, `sync_changed_since`, `asset_prices_price_positive`) all exist; `ai_credit_counters` is absent because 0302 drops it. So the schema is current and only the ledger drifted. Cause is the documented workflow, not the EU move: CLAUDE.md says "apply with `execute_sql`", which never writes the ledger; only `apply_migration` does. The 0298 collision is real but only across branches: `0298_auth_password_attempt_limit.sql` exists on unmerged `origin/auth-hardening` (3 commits ahead of main); main has `0298_credit_windows_and_plan_limits.sql`. `scripts/check-migrations.mjs` (part of `npm run verify`) would fail the merge as it stands. Next free number on main is `0318`.
- **Fix plan:**
  1. Collision: when `auth-hardening` is merged, rename its file to the next free number (`git mv` to `0318_auth_password_attempt_limit.sql` or later) and update any reference in that branch. No DB change (the file's header says it is not applied yet).
  2. Ledger, pick one (see question): (a) declare the repo folder the source of truth and the ledger informational: one sentence in `supabase/migrations/README.md` and in the CLAUDE.md "Session start" line so nobody diffs against `list_migrations`; or (b) backfill: insert one `schema_migrations` row (version timestamp + file name) per applied-but-unrecorded file, skipping `0252` and the superseded legacy files, and switch the workflow rule to `apply_migration` so new files record themselves.
  3. No test; `check-migrations.mjs` already guards prefix reuse on main.
- **Effort / risk:** S for the rename and option (a); M for (b) · (b) writes to a Supabase-managed table; a wrong row is harmless but the Supabase CLI was never usable against this folder anyway (4-digit prefixes, not timestamps).
- **Owner question:** Should the ledger be authoritative? (a) No, document that the repo is the record (recommended, zero risk). (b) Yes, backfill the 60-odd rows and change the workflow to `apply_migration`.
- **Related:** SEC-001 (blocked only by the rename in step 1).

### QA-62 · DB-005 · Savings RPCs accept any date (e.g. 2999-01-01)
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high (facts) / low (whether it should change)
- **Evidence:** Live `deposit_to_savings_v2`, `withdraw_from_savings_v2`, `correct_savings_balance_v2` only check `p_local_date IS NULL`; the value goes straight into `savings_transactions.transaction_date`. The table has no date CHECK, and the app writes these rows through RLS table sync, not through the RPCs (`src/lib/supabase/remote/sync.ts:350`; `0198_savings_rpc_v2.sql:9` "The client does NOT call the v2 functions yet"). So bounding only the RPCs, as the ticket proposes, closes nothing: the same date can be written directly. Impact is limited to the caller's own rows (a far-future row sorts first and can skew that user's own month views).
- **Fix plan:**
  1. Put the bound on the table so both doors are covered, with constant limits (a CHECK must not depend on `now()`): `ALTER TABLE public.savings_transactions ADD CONSTRAINT savings_transactions_date_sane CHECK (transaction_date >= DATE '2000-01-01' AND transaction_date < DATE '2100-01-01') NOT VALID`, run a bounded `SELECT count(*)` for violators, then `VALIDATE`.
  2. Only if the owner wants "not in the future": add `IF p_local_date > (now() AT TIME ZONE 'UTC')::date + 1 THEN RAISE EXCEPTION 'date is in the future'` to the three v2 RPCs. This does not cover direct table writes; covering those needs a BEFORE INSERT/UPDATE trigger, which would also reject a phone whose clock is wrong and stall that row's sync.
  3. Ship in the same migration as QA-60. Test: migration `ASSERT` that inserting `2999-01-01` raises `check_violation`.
- **Effort / risk:** S · Step 1 has no realistic regressions. Step 2/trigger risks rejecting legitimate offline rows from devices with a wrong clock.
- **Owner question:** Is a future-dated savings entry ever legitimate (planned deposit, entry made just after midnight in another timezone)? (a) Only block absurd dates (2000-2100 table check, recommended). (b) Also refuse anything more than a day ahead, accepting that a wrong device clock will get its row rejected.
- **Related:** QA-60.


## 6.3 Security

### QA-28 · SEC-001 · No per-account limit on password attempts; migration 0298 not applied
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high
- **Evidence:** HEAD has exactly one 0298 file, `supabase/migrations/0298_credit_windows_and_plan_limits.sql` (applied live as `credit_windows_and_plan_limits`, version 20261116015259). `0298_auth_password_attempt_limit.sql` exists only in commit `8a89dc83` on `origin/auth-hardening`, never merged (the other two commits of that branch reached main as `225b86df`). So there is no duplicate 0298 on main today; merging the branch as is would create one and fail `scripts/check-migrations.mjs`. Live DB (catalog read, 2026-11-18): `to_regprocedure('private.hook_password_verification_attempt(jsonb)')` and `to_regclass('private.auth_password_failures')` are both null, `supabase_auth_admin` has no USAGE on `private`, `list_migrations` has no such row. The browser signs in straight against Supabase Auth (`src/hooks/useAuthModal.ts:315`; also `src/hooks/useProfilePage.ts:125`, `src/lib/server/reauth.ts:34`), so no app route sits in the path and only an Auth-side control can limit attempts per account. **Blocker the ticket missed:** Supabase docs (Auth Hooks, "Available on Plan") list the Password Verification Attempt hook as Teams and Enterprise only, and `get_organization` reports this project's organisation on `plan: free`. The migration can be applied, but the hook cannot be switched on, so it would do nothing.
- **Fix plan:** (blocked on the owner question; two routes)
  - Route A, hook (needs a Team plan):
    1. Bring the file to main as `supabase/migrations/0318_auth_password_attempt_limit.sql` (0317 is the latest; do not reuse 0298), body from `8a89dc83`, plus `alter table private.auth_password_failures enable row level security;` (same convention as `private.session_second_factor`). No `database.types.ts` change (schema `private` is not exposed).
    2. Apply with `execute_sql`; verify by catalog: function exists, EXECUTE true for `supabase_auth_admin` and false for anon/authenticated, `has_schema_privilege('supabase_auth_admin','private','USAGE')` true; run `get_advisors`.
    3. Owner, dashboard only: Auth > Hooks > Password verification attempt > Postgres function `private.hook_password_verification_attempt`.
    4. Client needs no change: the reject message ("Too many attempts...") already lands on the rate-limit copy through the `too many` branch of `mapAuthError` (`src/components/auth/authErrors.ts:89`); add one test case pinning that. SQL proof on the local DB (`scripts/dev-db.sh reset`): 5 calls with `valid=false`, then `valid=true` returns `decision: reject`; after the window it returns `continue`. Live smoke test with a synthetic account afterwards.
  - Route B, no plan change: CAPTCHA on sign-in. Owner enables it in the dashboard (Auth > Attack Protection, Turnstile or hCaptcha); code passes `options.captchaToken` in the three `signInWithPassword` calls, sign-up and OTP requests, on web and in the native WebView, and installed builds without it must be held back by the existing min-version gate before enforcement. This raises the cost of automated guessing; it is not a per-account lock.
  - Not a fix: an app-route limiter. The public key can call `/auth/v1/token?grant_type=password` directly, which is why the hook was chosen.
- **Effort / risk:** Route A: S (file already written) plus one dashboard step. A hook that errors fails every password sign-in, so test right after enabling; anyone who knows an email can keep that account's password sign-in locked by failing 5 times a minute (noted in the file; email-code sign-in stays open); `reauth.ts` password confirmations count toward the same limit. Route B: L (web + both native apps + rollout gate); can lock out old builds.
- **Owner question:** The per-account limit needs Supabase's Password verification hook, which is Team/Enterprise only; the organisation is on Free. Choose: (1) upgrade to Team and ship route A; (2) add CAPTCHA on sign-in (route B); (3) accept the gap until launch, relying on Supabase's per-IP limits, optional email 2-step and password rules. If (1): keep 5 fails/minute only, or add a daily cap (for example 20 fails in 24 h), accepting that an attacker could then lock a known account's password sign-in for a day?
- **Related:** QA-29 (same credential-stuffing path, also blocked by the plan), QA-99 (email enumeration feeds it).

### QA-29 · SEC-002 · Leaked-password protection is disabled in Supabase Auth
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high
- **Evidence:** `get_advisors(security)` on `tzioppxwsljhlglyducm` today still returns `auth_leaked_password_protection` (WARN, "Leaked password protection is currently disabled"). This is a Supabase Auth project setting, not code: nothing in the repo can turn it on. **Blocker the ticket missed:** Supabase docs (Password security) say "Leaked password protection is available on the Pro Plan and above", and `get_organization` reports the organisation on `plan: free`, so the toggle is not available today. Code side: the app has no handling for the `weak_password` error the setting produces (`grep weak_password|weakPassword|pwned` in `src` finds nothing), so once enabled a leaked password would show the generic fallback at sign-up (`mapAuthError`, `src/components/auth/authErrors.ts:82-114`) and a 500 "Could not change the password" on change/reset (`src/app/api/auth/password/change/route.ts:59-67`).
- **Fix plan:**
  1. Owner only (billing + dashboard): upgrade the organisation to Pro, then Auth > Providers > Email > enable "Prevent use of leaked passwords" on `tzioppxwsljhlglyducm`. No migration.
  2. Code (small, ship before or with the toggle): in `mapAuthError` add a branch for `code === 'weak_password'` / message containing "weak" or "pwned" in the `signup` context returning a new dictionary string (for example `auth.errorLeakedPassword`, English and Arabic; the existing `errorWeakPassword` text is about letters and digits and does not fit). In `password/change/route.ts` map `updated.error.code === 'weak_password'` to `422 { code: 'weak_password' }` next to the existing `same_password` branch, and show the same string where the client already handles `same_password` (`src/hooks/useAuthModal.ts` near line 560 and the profile password form).
  3. Tests: a case in the auth-errors test (weak-password error maps to the new copy) and one in the password-change route test (Auth returns `weak_password`, route answers 422 with the code and restores the SMS tokens as it does for `same_password`). Both fail before, pass after.
  4. After the toggle: re-run `get_advisors(security)`; the warning must be gone. Existing users keep signing in with an old leaked password (Supabase only reports it on sign-in); forcing a change is a separate product choice, not part of this ticket.
- **Effort / risk:** S for the code; the toggle itself is one click after the plan change. Risk: without step 2, users picking a leaked password see an unexplained error.
- **Owner question:** The setting needs the Supabase Pro plan and the organisation is on Free. Upgrade to Pro now (also the natural step before launch), or leave this open until the upgrade happens?
- **Related:** QA-28 (same attack path; together they are the realistic account-takeover route).

### QA-30 · SEC-003 · A revoked session's JWT keeps PostgREST access until it expires
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high
- **Evidence:** Live `private.db_pre_request()` (wired through `authenticator` role config `pgrst.db_pre_request=private.db_pre_request`) only runs `private.app_client_gate()` and `private.two_factor_gate()`; neither looks at `auth.sessions`, and the 2FA gate returns early for users without 2-step. `public.revoke_auth_session` just deletes the `auth.sessions` row. The behaviour is known and written down: the comment on `DELETE` in `src/app/api/devices/[id]/route.ts:49-58` says the access JWT "keeps working until it expires (at most ... one hour by default)". App routes use `resolveRouteIdentity` (`src/lib/supabase/resolveRouteUser.ts:86`, local signature and expiry check only); only routes using `resolveVerifiedIdentity`/`resolveRouteUser` ask Auth. So after removing a phone, signing out elsewhere or a password change, the old token still reads and writes every RLS table for up to the JWT lifetime. Not a hidden bug, but a real gap for a finance app. Nothing in 0315/0316 touches it.
- **Fix plan:**
  1. Code, migration `03xx_session_live_gate.sql` (next free number at the time; 0317 is the latest today): add `private.session_live_gate()` (plpgsql, STABLE, SECURITY DEFINER, `search_path = ''`), in the style of `two_factor_gate`: read `request.jwt.claims`; return unless `role = 'authenticated'` and `session_id` is present; `if not exists (select 1 from auth.sessions where id = sid)` raise `sqlstate 'PGRST'` with status 401 and code `session_revoked` (same raise shape as the 2FA gate). Add `perform private.session_live_gate();` to `private.db_pre_request()` between the two existing gates. Revoke EXECUTE from public/anon/authenticated as 0315 requires; `authenticator` reaches it only through `db_pre_request`. Cost: one primary-key lookup on `auth.sessions` (`sessions_pkey`) per PostgREST request; run `EXPLAIN` on that lookup first as the DB-load rules require.
  2. Rollout switch: read a `platform_settings` row (`session_live_gate`, mode `off|report|enforce`, the same pattern as `enforce_2fa_gate`), start in `report` (`raise log` only) for a day, then `enforce`. Any exception inside the gate other than the deliberate 401 returns (fail open), so an Auth-schema problem cannot lock every user out.
  3. Client: confirm a 401 with `session_revoked` ends in a local sign-out. The refresh token is already dead, so supabase-js signs out at the next refresh; if the app should react at once, handle the code where `noteSecondFactorResponse` handles the 2FA header (`src/lib/apiBase.ts`). Update the comment in `devices/[id]/route.ts`.
  4. Proof (no SQL unit harness in vitest): on the local DB (`scripts/dev-db.sh`), sign in a synthetic user, `GET /rest/v1/expenses` returns 200, delete its `auth.sessions` row, the same token returns 401 `session_revoked`; a second live session of the same user still returns 200; a service-role call and an anon call are unaffected. Repeat once on production with a synthetic account.
  5. Owner, dashboard only (optional, no code): lower the access-token lifetime (Auth settings, JWT expiry, default 3600 s) to shrink the window on everything the gate does not cover: app API routes that verify locally, Realtime sockets and Storage.
- **Effort / risk:** M · the gate runs on every data request, so a mistake here is an outage for all signed-in users (hence report mode and fail-open); any token minted without a real `auth.sessions` row (test tooling, custom-signed JWTs with role `authenticated`) would be refused once enforced.
- **Related:** API-003 ticket (same root cause on the API-route side: `resolveRouteIdentity` never asks Auth); QA-102 (device removal also retires that phone's SMS token, which already takes effect at once).

### QA-98 · SEC-004 · Some link columns accept another user's ids
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** Live triggers (catalog read of `pg_trigger` for `private.assert_link_owner`, 20 tables) cover only scalar FK-style columns; the function reads one uuid per column (`to_jsonb(NEW) ->> col`) and cannot check arrays (`supabase/migrations/0250_p3_grants_link_guards_profile_email.sql:39-62`). Still unguarded on tables `authenticated` can write: `goals.linked_savings_account_ids`, `goals.linked_debt_ids`, `budget_categories.link_ids` (uuid arrays; `goals` has no link trigger at all); `expenses.funded_from_savings_tx_id`, `debt_payments.funded_from_savings_tx_id`; `sms_log_id` on `expenses`, `income_events`, `debt_payments`; `retracted_by_sms_log_id` on `expenses`, `income_events`; `payment_methods.parent_id` (FK, no owner check). `shared_plan_id` / `active_shared_budget_id` / `default_shared_budget_plan_id` have no parent table at all (`0205_b3_link_column_fks.sql:18-19`), so there is nothing to check them against. Impact stays low: every server reader I traced scopes by `user_id` (for example `src/lib/server/allocateGoalFunding.ts:50-51` filters the caller's own accounts; SMS routes add `.eq('user_id', userId)`), and RLS hides the foreign row. The one cross-user effect I found: the purge guards in `0251_p3_housekeeping_guards_2fa_failclosed.sql:28-30,53-55` are not scoped by owner, so a row pointing at someone else's `savings_transactions`/`sms_parse_log` id would stop that row being purged. It needs the victim's row uuid, which nothing exposes.
- **Fix plan:**
  1. Migration `03xx_link_guard_remaining.sql`. Scalars: re-create the existing `link_guard_*` triggers with the extra pairs (the helper loop from 0250 can be reused as is): `expenses` + `sms_log_id→sms_parse_log`, `retracted_by_sms_log_id→sms_parse_log`, `funded_from_savings_tx_id→savings_transactions`; `debt_payments` + `sms_log_id→sms_parse_log`, `funded_from_savings_tx_id→savings_transactions`; `income_events` + `sms_log_id→sms_parse_log`, `retracted_by_sms_log_id→sms_parse_log`; new trigger on `payment_methods` for `parent_id→payment_methods`. `assert_link_owner` already leaves a missing parent alone, which these FK-less columns need (parents get purged, sync pushes tables in any order).
  2. Arrays: add `private.assert_link_array_owner()` (same trigger-arg convention, same 23503 error) that raises when `exists (select 1 from public.<parent> where id = any($1) and user_id <> $2)`; attach to `goals` (`linked_savings_account_ids→savings_accounts`, `linked_debt_ids→debts`). `budget_categories.link_ids` points at debts or a goal depending on `link_type` (`src/lib/store/types.ts:436`), so check it against both parents. Revoke EXECUTE from public/anon/authenticated (0315 rule; trigger functions need none).
  3. Before applying: one bounded check per column for existing cross-user rows (the 0221 header did the same), so the new triggers do not start rejecting sync writes for a row that is already wrong. Each new check is a primary-key lookup per non-null link, on write only.
  4. Scope the two purge guards from 0251 by owner (`AND x.user_id = savings_transactions.user_id`, same for `sms_parse_log`) in the same migration; that removes the only cross-user effect even for rows written before the guard.
  5. Proof on the local DB (`scripts/dev-db.sh reset`): as user A insert a goal with user B's savings-account id and an expense with B's `sms_parse_log` id: both raise 23503 after, both succeed before; the same writes with A's own ids and with a non-existent id still succeed.
- **Effort / risk:** M · a wrong parent table in a trigger arg blocks legitimate writes for that table (the sync runner retries per row, so it would show as parked rows); SMS routes write these columns through the service role and fire the same triggers.
- **Related:** none in this slice.

### QA-99 · SEC-005 · POST /api/auth/check-email reveals whether an email is registered and verified
- **Verdict:** UNSURE · ticket P3 → my severity P3 · confidence high (on the facts)
- **Evidence:** `src/app/api/auth/check-email/route.ts` returns `{ exists, verified }` for any well-formed email (lines 63-76), limited to 30 hits per 60 s per IP (`RATE_MAX_HITS`, line 31) and fails open when the counter errors (`isRateLimited(..., true)`, line 57). The 100 ms floor is on main (commit `225b86df`; the ticket cites the branch commit `bb1b146c`) with the comment that the body already reveals existence. This is deliberate: the email-first sign-in/sign-up modal decides between the two forms from this answer (`src/hooks/useAuthModal.ts:147-198`). Guards that do hold: the RPC is server-only (live: `check_email_status` EXECUTE false for anon and authenticated, set by 0315), and the IP comes from `x-real-ip`/last forwarded hop (`src/lib/server/clientIp.ts`), so a caller cannot pick a fresh bucket by header. The fail-open matters little in practice: counter and lookup hit the same database, so when the counter fails the lookup normally fails too (500). What remains is the product choice plus the volume: about 43,000 lookups per IP per day.
- **Fix plan:** (for the recommended option 2 below; no migration)
  1. `route.ts`: add a second counter after the existing one, `check-email-day:${ip}`, window 86,400 s, a few hundred hits (a real person needs fewer than ten). Reuse `isRateLimited`/`api_rate_hit`; one extra RPC per call.
  2. Drop the `true` argument on both calls so a counter outage answers 429 instead of an unlimited lookup. Sign-up cannot proceed during a database outage anyway.
  3. Add `src/app/api/auth/check-email/route.test.ts` (none exists) with the mocks used by `src/app/api/sms/setup-token/route.test.ts`: counter returns `error` → 429 and `check_email_status` is not called (fails today); day cap reached → 429 (fails today); normal call → `{ exists, verified }`.
- **Effort / risk:** S · a shared office or carrier NAT IP could hit the daily cap during a busy day; on a 429 the modal does not block: it falls back to the sign-in form with the Create account toggle (`src/hooks/useAuthModal.ts:233-239`).
- **Owner question:** Is telling a visitor whether an email has an account an accepted product choice (the email-first modal depends on it)? Options: (1) keep as is; (2) keep the lookup but cap it per IP per day and fail closed (recommended, small); (3) remove the signal entirely, which means redesigning the modal so sign-in and sign-up look identical until a code or password is checked (large UX change).
- **Related:** QA-28, QA-29 (enumeration supplies the target list for password guessing); the DB-001 ticket (fixed-window counter allows about 2x the limit at a window edge, which applies to this route too).

### QA-100 · SEC-006 · CSP allows any Supabase project and any HTTPS image host
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `src/lib/security/csp.ts:7,10` still emits `img-src 'self' data: blob: https:` and `connect-src 'self' https://*.supabase.co wss://*.supabase.co ...` (last touched in `1e0fc022`, before the audit), and `src/lib/security/csp.test.ts:26-30` pins `https://*.supabase.co`. `src/proxy.ts:69,91,149` applies it to app pages. The same wildcard pattern exists for Sentry (`https://*.ingest.sentry.io` and the `.de`/`.us` variants accept any Sentry organisation). This is defence in depth only: the script policy (nonce + `strict-dynamic`, no inline, no eval) is what stops injection, and the native apps have no CSP at all (static bundle, `docs/CSP.md`). Images the app really loads from other origins: profile photos stored as an `https://` URL (`src/lib/profile/avatarDisplay.ts:8`, upload in `AvatarPickerModal.tsx:132`, bucket `avatars`) and whatever image URL staff type into the admin email editor (`src/components/features/admin/emails/BlockEditor.tsx:19`).
- **Fix plan:** (no migration)
  1. `src/lib/security/csp.ts`: build the Supabase origin from the configured URL instead of the wildcard: `const supabase = new URL(requireSupabaseUrl()).origin` (helper in `src/lib/supabase/env.ts`), then `connect-src 'self' ${supabase} ${supabase.replace('https', 'wss')} ...`. Deriving it from the env keeps previews and local dev (different project URL) working without a hard-coded ref.
  2. `img-src 'self' data: blob: ${supabase}` (covers the `avatars` bucket). Check first where the admin email preview renders: if it is inside the page (not a sandboxed iframe), either keep `https:` on `/admin` only or accept that external images do not preview.
  3. Optional, same change: pin the Sentry entry to the host of the configured DSN (`src/lib/crash/init.ts:39`) instead of three wildcards.
  4. Tests in `csp.test.ts`: replace the `https://*.supabase.co` assertion with "connect-src contains the configured project origin and no `*.supabase.co`", and add "img-src has no bare `https:`". Both fail today. Update `docs/CSP.md`. Then run `node scripts/csp-check.mjs` against a production build as that doc describes and click through sign-in, realtime sync, avatar upload and push registration with the console open for CSP violations.
- **Effort / risk:** S · a missed host shows up as a blocked request, not an error page: realtime (wss), avatar images, crash reports. An imported profile whose `avatar` is an arbitrary `https://` URL (`financeImportSchema.ts:80`) would stop rendering, which is the intended tightening.
- **Related:** none in this slice.

### QA-101 · SEC-007 · pg_net request functions are executable by anon and authenticated
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 (lowest priority in this slice) · confidence high on the state, medium on the fix
- **Evidence:** Not closed by 0315/0316: 0315 only loops over `pronamespace = 'public'` and its default-privilege change is for role `postgres` in schema `public`. Live today: `has_function_privilege` is true for both `anon` and `authenticated` on `net.http_get`, `net.http_post`, `net.http_delete` (and the other nine `net.*` functions); both roles have USAGE on schema `net`; `get_advisors(security)` still reports `extension_in_public` for `pg_net` (0.20.4). Detail the ticket did not have: the functions and the two tables are owned by `supabase_admin` with a null ACL, so the access comes from the PUBLIC default, not from a grant to anon/authenticated; `net.http_request_queue` and `net._http_response` also carry full PUBLIC privileges. This is the stock Supabase pg_net install, not something a migration of ours did. It is unreachable while `net` is not an exposed API schema (the ticket's 406 test; I did not repeat it, and no SQL path from a client role into `net` exists in `public`: the only caller is `public.notifications_tick`, SECURITY DEFINER, owner `postgres`, plus pg_cron jobs).
- **Fix plan:**
  1. First find out whether we can change it at all. `postgres` is not the owner and not a member of `supabase_admin`, so `REVOKE ... FROM PUBLIC` on these objects is expected to end in "no privileges could be revoked" and change nothing. Try it on the local DB (`scripts/dev-db.sh up`), not on production: `revoke execute on all functions in schema net from public, anon, authenticated; revoke usage on schema net from public, anon, authenticated; revoke all on all tables in schema net from public, anon, authenticated;` then re-read `has_function_privilege`.
  2. If the revoke works: ship it as a migration, and in the same migration `grant usage on schema net to postgres, service_role` and `grant execute on function net.http_post(...) to postgres` (and any other function `notifications_tick` or a cron job calls). Revoking PUBLIC also removes `postgres`'s own access, and that would silently stop the hourly notifications tick. Proof: `has_function_privilege('anon'|'authenticated', ...)` false, `select public.notifications_tick()` (as the cron runs it) still queues a request. Add the statements to the "after a restore or region move" list in `CLAUDE.md`, because re-creating the extension restores the defaults.
  3. If the revoke is a no-op (likely): do not chase it. Record in `CLAUDE.md` (Database & migrations) that `net` must never be added to the exposed schemas in the dashboard API settings, and close the ticket as accepted platform default.
  4. `extension_in_public` (cosmetic): moving pg_net means dropping and re-creating it from the dashboard with schema `extensions`; that clears the request queue and stored responses and briefly breaks `notifications_tick`. Only worth doing in a quiet window, and it does not change who can execute the functions.
- **Effort / risk:** S · the real risk is step 2 done carelessly: revoking PUBLIC without re-granting to `postgres` stops push/notification scheduling with no error shown to anyone.
- **Owner question:** If the revoke cannot be applied by our role (step 3), is "accepted: default Supabase state, guarded by never exposing the `net` schema" an acceptable way to close this, or should it be raised with Supabase support?
- **Related:** none in this slice (0315/0316 cover `public` only).

### QA-102 · SEC-008 · SMS ingest tokens never expire; GET /api/sms/setup-token changes state
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence high
- **Evidence:** Two separate claims.
  (a) No expiry: true and deliberate, so not a defect. Live `sms_ingest_tokens` columns are `id, user_id, created_at, is_active, device_id, token_hash` (no expiry, no last-used). The code states the intent in several places: `src/hooks/useSmsTracking.ts:110-111` ("non-expiring ingest token ... so the bridge survives the 1-hour JWT TTL"), `src/lib/native/smsTracker.ts:209-213` ("it never expires, so stale-but-valid beats clobbered"), `src/app/api/auth/password/change/route.ts:48`. The killed-app forwarders (Android worker, iOS intent) hold only this token and cannot refresh anything, so an expiry would stop capture silently on a phone whose app has not been opened. Controls that exist: only the hash is stored; tokens are retired on rotation, phone removal (`src/app/api/devices/[id]/route.ts:75`), password change, admin action and the legacy-build pause; at most 3 active per device scope (`src/lib/server/tokenCaps.ts:7,29-35`); removed or unregistered phones get none (`setup-token/route.ts:30-41`); a suspended account resolves to no caller (`src/lib/sms/resolveSmsUser.ts:19`). The token only works on the ingest routes (`sms/parse`, `sms/ack`, `sms/health`); `undo`, `own-transfer` and `flag-action` refuse a non-JWT bearer, so a leaked token can inject messages but cannot read the ledger.
  (b) GET with side effects: true. `GET` in `src/app/api/sms/setup-token/route.ts:44-80` inserts a token and calls `capActiveIngestTokens`. On web the caller is identified by cookie (`apiFetchAuth` sends cookies on web, `src/lib/apiBase.ts:97`), and the auth cookies are `SameSite=Lax` (`src/lib/supabase/cookieDomain.ts:82`), which are sent on a cross-site top-level navigation. So a link to this URL, opened four times, retires the account's device-less tokens (the scope a browser request falls into). Phone tokens are device-scoped and untouched, link-preview bots carry no cookie, and the attacker never sees the token, so the effect is limited to knocking out a web/legacy-issued token. The response also has no `Cache-Control: no-store` (the proxy sets it only for `/admin`, `src/proxy.ts:139-142`).
- **Fix plan:** (for (b); no migration)
  1. `src/app/api/sms/setup-token/route.ts`: move the body of `GET` into one function and export it as `POST`. Keep `GET` only for requests that carry an `Authorization: Bearer` header (the native builds already installed call it that way, and a cross-site page cannot add that header); a cookie-only `GET` answers 405 with `Allow: POST`. Add `Cache-Control: no-store` to both token responses.
  2. Switch the callers to `{ method: 'POST' }`: `src/hooks/useSmsTracking.ts:106,198,237,255` and `src/lib/native/smsTracker.ts:222`. Cross-site POSTs do not carry Lax cookies, so no extra CSRF token is needed.
  3. `route.test.ts` (exists): cookie-only GET returns 405 and inserts nothing (fails today); POST issues a token; GET with a Bearer header still issues one. Update the header comment and the mention in `src/app/api/sms/revoke-token/route.ts:7`.
  4. Later, once the minimum app version is past the build that uses POST, delete the GET branch.
- **Effort / risk:** S · the Bearer exception is what keeps installed phones working; dropping GET outright would stop every current build from arming SMS capture.
- **Owner question:** Part (a) conflicts with the recorded design (the phone stores only a non-expiring ingest token; an expiring one risks silent SMS loss). Keep tokens non-expiring and close that half as by design (recommended), or add an expiry? If an expiry is wanted, the only safe form is "retire tokens of a device that has since been issued newer ones after N days", because the app already issues a fresh token at every start; a plain age limit would cut off phones whose app is rarely opened.
- **Related:** QA-30 (phone removal: the SMS token dies at once, the session JWT does not).


## 6.4 SMS pipeline

### QA-31 · SMS-001 · Second identical purchase dropped when the capture has no capture id
- **Verdict:** CONFIRMED · ticket P2 → my severity P3 · confidence high
- **Evidence:** Without `eventId`, `computeSmsHash` hashes text + a 2-minute bucket (`src/lib/sms/ingestGuards.ts:28-30,56-61`). A second identical text in the same bucket hits the unique index `(user_id, sms_hash) where is_duplicate=false` (`supabase/migrations/0083_sms_dedup_unique_index.sql:43`) and gets `{ok:true,duplicate:true}` (`src/app/api/sms/parse/route.ts:806-819`); one in a neighbouring bucket is answered "duplicate" before any claim row exists (`route.ts:762-775`), so there is no log row. Both exits are above the I5 book-and-flag check (`route.ts:837-854`), which is only reachable when the two hashes differ. With no `receivedAt` at all the hash is the text alone, so the same text is dropped with no time limit.
  Reach is small: Android mints a UUID per SMS (`android/.../SmsReceiver.kt:78`), iOS mints one per capture (`ios/App/App/CatchBankSmsIntent.swift:54,129-137`), both since `044d99ce` (2026-10-28). Only builds older than that, or items they queued, send no id. Note the ticket's "expected flagged" is not exact: I5's window is 3 minutes (`captureGuard.ts:4`), so at 3m40s the second copy would book unflagged.
- **Fix plan:**
  1. `src/lib/sms/ingestGuards.ts`: when there is no `eventId` but a valid `receivedAt`, make the retry identity the capture second (`captureSecond`, already computed) instead of the 2-minute bucket, and return no neighbour hashes for that case. An exact retry carries the same stored `receivedAt` and still collapses on `sms_parse_log_same_capture_idx` (migration 0272); a different capture now gets its own claim row and reaches I5 (`secondCopyVerdict`: reference or balance = proven duplicate, otherwise booked and flagged `possible_duplicate`).
  2. `route.ts:762-775`: keep the legacy-hash lookup only for rows whose `captured_at` equals this capture (old rows stored under the bucket hash), so a real retry of an old row is still recognised.
  3. No migration.
  4. Test (fails before): `src/app/api/sms/parse/route.capture.test.ts`, same text twice with no `eventId`, `receivedAt` 100 s apart, no reference/balance → two expenses, second carries `possible_duplicate`; same `receivedAt` twice → one expense.
- **Effort / risk:** S-M · An old build that forwarded one SMS twice with two different times (two Shortcut automations) is now booked twice and flagged instead of collapsed. That is the same trade-off I5 already makes for capture-id builds.
- **Related:** QA-33 (same I5 rule, opposite complaint).

### QA-32 · SMS-002 · A message with two transactions books only the first
- **Verdict:** CONFIRMED · ticket P2 → my severity P3 · confidence high
- **Evidence:** `matchCuratedPattern` returns on the first regex hit (`src/lib/sms/patterns/index.ts:109-115`), a learned template yields one extraction (`route.ts:192-239`), and the AI schema is one object (`src/lib/sms/aiParserPrompt.ts:23-39`, "extracting a single financial transaction"). The route carries one `ParsedTx` through to one `createSmsTransaction` call (`route.ts:857,1136`). Nothing counts amounts. No real bank sample of a two-transaction SMS exists in the repo fixtures; the input was constructed.
- **Fix plan:**
  1. `route.ts`, after the tier is chosen and before dispatch: for the curated and template tiers, run the matched regex again from the end of the first match; a second non-overlapping match with a different amount means the message holds two movements. Call the existing `holdForReview` with a new code `multiple_transactions` (add it to its union at `route.ts:1037` and to the "check" list in `src/lib/sms/heldReview.ts:25`). The row then waits in the review list instead of booking half.
  2. AI tier: add `"transaction_count": number` to the schema in `aiParserPrompt.ts` and hold the same way when it is above 1.
  3. Do not key on "two amounts" alone: fee lines, balances and FX messages carry two amounts in one real movement.
  4. No migration (`failure_code` is free text).
  5. Test: `src/app/api/sms/parse/route.test.ts`, the ticket's Uber + Starbucks body → held with `multiple_transactions`, no expense; a purchase with a trailing balance and a fee line still books.
- **Effort / risk:** M · A false hold on a format that legitimately repeats its own wording. Low value until a real sample exists; reasonable to leave in backlog.
- **Owner question:** Do you have a real bank SMS that carries two transactions? If not, leave this in backlog (my recommendation); if yes, send it so the detector is built against it.

### QA-33 · SMS-003 · Same SMS under three capture ids is booked three times
- **Verdict:** NOT-A-BUG · ticket P2 → my severity P3 · confidence high
- **Evidence:** This is rule I5 working as written. A second copy of a text within 3 minutes is a proven duplicate only when it prints a payment reference or a running balance; otherwise "two identical texts minutes apart may be two real purchases (twin coffees), so the later one is booked and flagged, never dropped" (`src/lib/sms/captureGuard.ts:46-53`, applied at `route.ts:840-854`). The test message has neither, so copies 2 and 3 are booked with `possible_duplicate`, and the user gets a prompt for that flag (`src/lib/sms/flagPrompts.ts:11-12`, `src/components/features/flow/SmsFlagPrompts.tsx`). The same capture re-sent under a new id is collapsed by `sms_parse_log_same_capture_idx` (migration 0272), and iOS reuses one id for the same text within 15 s (`CatchBankSmsIntent.swift:110,131-134`). Three ids 20 s apart needs the phone to receive the text three times.
- **Effort / risk:** If tightened: S · any auto-collapse window drops a real twin purchase inside it.
- **Owner question:** Keep "book and flag" for every identical text within 3 minutes (current), or auto-collapse identical texts that arrive less than about 60 seconds apart and keep book-and-flag only for 1 to 3 minutes?
- **Related:** QA-31.

### QA-34 · SMS-004 · Own-transfer legs captured on two phones are booked as spending plus income
- **Verdict:** NOT-A-BUG · ticket P2 → my severity P3 · confidence high
- **Evidence:** The decision rule is deliberate and documented: a pair settles only when it was seen on one device plus one decisive signal; anything short of that asks the user (`src/lib/sms/ownTransferDecision.ts:4-16,43-44,63-70`; council guard in `docs/launch/S1-sms-audit.md:115`). On two phones `sameDevice` is false (`src/lib/sms/dispatch.ts:462`), so reference + name + profile gives `ask`: both legs are booked as their plain kind and the pair is put to the user (`recordOwnTransferEvidence`, `dispatch.ts:473`; shown by `src/hooks/useOwnTransferReview.ts` in `src/components/features/flow/OwnTransferPrompts.tsx`; a yes converts it through `/api/sms/own-transfer`). The audit's own result says the verdict was "ask".
  One real gap worth knowing: `answered` is decisive only together with `device` (`ownTransferDecision.ts:43,67`), so a user with two phones who already said "both accounts are mine" is asked again on every transfer between them.
- **Effort / risk:** If relaxed: S (one rule in `decideOwnTransfer` + cases in its test) · wrongly hiding a real payment to another person, which the design calls the worst error in the app.
- **Owner question:** For a pair seen on two different phones, which should settle without asking: (a) nothing, always ask (current); (b) only pairs the user already answered "both mine" for (my recommendation); (c) also a shared payment reference when both accounts are registered accounts of the user?
- **Related:** QA-38 (same decision function; ship together if (b) or (c) is chosen).

### QA-35 · SMS-005 · One user's correction can reach every user's AI prompt
- **Verdict:** CONFIRMED · ticket P2 → my severity P3 · confidence high
- **Evidence:** `formatCorrectionExemplar` quotes the newest row's `corrected_fields` and `redacted_body`, but decides trust over the whole set of up to 10 rows: `rows.some(r => r.source_template_id) || users.size >= 2` (`src/lib/sms/correctionExemplar.ts:26-33`). So a newest single-user, no-template row is quoted whenever any older row is template-linked, or whenever two users have rows for the shape even if they disagree. That breaks the function's own stated rule ("A single user's edit never reaches another user's prompt", line 24). The existing tests cover only the pure cases (`correctionExemplar.test.ts:13-24`).
  Impact is limited: the quoted fields are not the user's raw edit. They are the adjudicator's reading, checked field by field against the message (`validateCorrection`, `src/lib/sms/adjudicator.ts:193-211`), limited to amount, currency, kind, last4 and date, and the body is `maskPii`-masked (`src/lib/sms/runAdjudication.ts:161-168,246-253`). No free text gets through.
- **Fix plan:**
  1. `correctionExemplar.ts`: pick the row to quote from the trusted rows only: the newest row that has `source_template_id`, or the newest row whose `kind` and `currency` are also reported by a row from a different user. Return null when no row qualifies. No query change.
  2. Same file: quote only `kind` and `currency` from `corrected_fields`. Amount, last4 and date belong to one person's transaction and are no use as a reading for another message.
  3. No migration.
  4. Test: `src/lib/sms/correctionExemplar.test.ts`: (a) newest = single user without template, older = template-linked → the exemplar carries the older row's fields; (b) two users with different kinds → null. Both fail today.
- **Effort / risk:** S · fewer exemplars reach the prompt, so a repeated AI misread of a shape takes one more correction to be remembered.

### QA-36 · SMS-006 · The main AI parse sends the unmasked SMS to Gemini
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high
- **Evidence:** What goes to the model today (Google Generative Language API, `src/lib/server/ai/gemini.ts:23`):
  - Main parse: the whole SMS, only bidi/digit-normalised, no masking: `callGemini(apiKey, message, exemplar)` builds `SMS / notification text:\n${message}` (`route.ts:978,1747-1757`; `message = normalizeSmsText(rawMessage)` at `route.ts:720`). Names, phone numbers, references, account masks and balances are all in it. The sender id and user id are not sent.
  - Merchant categoriser: the merchant plus the first 300 characters of the same unmasked SMS (`route.ts:1192,1716`; `src/lib/sms/merchantCategoryPrompt.ts:10-14`).
  - Regex learning: masked with `maskForModel` (`route.ts:435`): names become stand-ins, phones and long digit runs become synthetic digits, amounts/dates/last four stay.
  - Adjudicator: `maskForModel(..., { keepNumbers: true })` (`src/lib/sms/adjudicator.ts:126`): names, phones, emails masked; account and reference digits stay visible.
  - Correction exemplar: another message's `maskPii`-masked body (`correctionExemplar.ts:32`).
  So masking exists on three of the five model-bound paths and is missing on the two the ticket names. `maskForModel` cannot be dropped in as it is: it needs the already-extracted amount to protect it (`maskForModel.ts:92`), and `maskNames` also replaces ALL-CAPS runs, which would hide the merchant the model must read and categorise.
- **Fix plan:**
  1. `src/lib/sms/maskForModel.ts`: add a parse-time view (new exported function next to `maskForModel`, reusing `findNameSlots`, `EMAIL_RE`, `URL_PATH_RE`, `PHONE_LIKE_RE`): replace only the counterparty name slot of a transfer with stand-ins and return the stand-in → original map; replace emails, URL paths and phone-like numbers; replace digit runs of 9+ digits with synthetic digits keeping the last four. Leave merchants, amounts, balances, dates and short numbers alone (the model needs them to tell amount from balance).
  2. `route.ts` `callGemini` call site: send the view's message; map stand-ins back in `merchant`, `cleanTitle` and `merchantNormalized` of the result. Everything after it (own-name check, counterparty hash, reference, balance, last four) already reads the server's raw `message`.
  3. `route.ts:1192`: pass `maskForModel(message, { merchant, kind, amount }).message` to `aiCategorizeMerchant` instead of the raw body.
  4. No migration.
  5. Tests: `src/lib/sms/__tests__/maskForModel.test.ts`: transfer sample → view has no name, phone or full reference, and the restored title carries the real name. `route.test.ts`: the body passed to `fetch` for the parse contains none of them. Before merging, run the gold-set replay (`src/lib/sms/gold/`) on masked input and compare accuracy.
- **Effort / risk:** M · parse accuracy: a mis-detected name slot changes what the model sees; an integer amount of 9+ digits with no separator would be altered (none exists under the 1e9 plausibility cap in practice). Balances stay visible by necessity.
- **Owner question:** Is masking names, phones and account/reference numbers enough, with balances still sent because the model needs them, or must balances be hidden too (that needs a different approach and will cost accuracy)?
- **Related:** QA-14 (same call site; masking does not fix injection), QA-39.

### QA-37 · SMS-007 · HSBC "Transfer to … EGP n+" booked as a currency exchange with no account
- **Verdict:** PARTIAL · ticket P2 → my severity P2 · confidence high
- **Evidence:** The classification is intended and the "+" question is already settled. The exact message is a real captured sample in the tests and is asserted to be `currency_exchange` via `hsbc-phone-banking-fx-credit` (`src/lib/sms/patterns/hsbc.ts:61-70`, `src/lib/sms/patterns/__tests__/patterns.test.ts:97-98,199-208`, commit `f29ce52d` BUD-47). "+" is HSBC's ledger sign for a credit, taken from real paired samples (`src/lib/sms/directionGuard.ts:4-12`, `aiParserPrompt.ts:51`). A lone leg booking one non-spend "Currency Exchange" row is the designed single-leg result (`dispatch.ts:509-540`).
  What remains is the missing account. Both HSBC phone-banking patterns put the account mask into `counterparty`, not `last4` (`hsbc.ts:67,77`), so `row.last4` is null. For a credit leg the destination comes from `resolveCreditAccount(row)` (`createSmsExpense.ts:525-535,635`), which without digits only resolves wallets by provider (`createSmsExpense.ts:364-390`), so a bank account is never found; the source side uses `counterpartyLast4`, also null. The same holds when both legs pair, so an HSBC exchange never moves either account's balance.
- **Fix plan:**
  1. `src/lib/sms/patterns/hsbc.ts`, patterns `hsbc-phone-banking-fx-credit` and `-fx-debit`: capture only the visible tail after the mask (for example `to\s+[\d\-]*\*+-?(\d{2,6})`) and map it as `last4` instead of `counterparty`. In this statement format the account after "to"/"from" is the user's own account being credited or debited. A tail of three digits is already supported with bank agreement by `matchByTail` (`src/lib/accounts/identity/accountRef.ts:79-97`).
  2. Do not use the whole mask as `last4`: `tryPattern` would strip non-digits and take "4001" across the stars (`patterns/index.ts:78-79`).
  3. No migration.
  4. Tests: `patterns.test.ts:199-219` (expect `last4 === '001'` / `'110'`, `counterparty` null); `src/lib/sms/fxPairing.test.ts`: a lone credit leg sets `to_payment_method_id` to the user's HSBC account ending 0001, and a paired exchange carries source and destination.
- **Effort / risk:** S · the title falls back to "Currency Exchange — HSBC" (already the case); an account whose saved digits do not end in the printed tail stays unassigned as today.
- **Owner question:** A same-currency phone-banking transfer between two own HSBC accounts (EGP to EGP) uses this same wording and is also labelled "Currency Exchange", and its two legs never pair because the exchange rule requires different currencies (`0277_sms_try_pair_wallet_fee.sql`, currency_exchange branch). Do you make such transfers? If yes that needs its own change.

### QA-38 · SMS-012 · Own transfer with a shared reference booked as spending plus income when the second SMS is over 5 minutes late
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high
- **Evidence:** `PAIR_WINDOW_SECONDS = 300` (`src/lib/sms/pairing.ts:23`) bounds every lookup: the candidate read (`pairing.ts:101-102`), and the claim (`p_window_seconds`, `pairing.ts:590`; enforced in SQL by `s.received_at BETWEEN …` in `supabase/migrations/0277_sms_try_pair_wallet_fee.sql`). A shared reference only changes how a leg inside the window is matched (`pairing.ts:108-110`); it never widens the window. At 6 minutes no candidate is found, `decideOwnTransfer` has nothing to decide, and each leg books as its plain kind (`dispatch.ts:454-495`). No later job re-pairs. The per-user `reference_hash` is already stored and indexed (`0270_sms_reference_hash.sql`, `sms_parse_log_user_reference_idx`).
- **Fix plan:**
  1. `pairing.ts` `findOwnTransferCandidate`: when the leg has a reference and the in-window read finds nothing, do a second read by `user_id` + `reference_hash` (indexed equality, `limit 5`) for an unpaired opposite-direction leg received within 24 hours, amount within `transferFeeTolerance`. Return it with `sameReference: true`. Pass the leg's `referenceHash` in from `dispatch.ts:453`.
  2. `pairing.ts` `tryPairLeg`: add an optional `windowSeconds` and send it as `p_window_seconds`; `dispatch.ts:477-491` passes the wider value only when claiming a `siblingId` that was found by reference. The RPC already takes the window and the sibling id as arguments.
  3. The verdict still goes through `decideOwnTransfer` unchanged (one phone + reference settles; two phones asks). The earlier leg is retagged by `finalizeOwnTransferPair`, the same path used when legs are seconds apart.
  4. No migration. Run `EXPLAIN` on the new read against the live DB before shipping (project rule).
  5. Test: `src/lib/sms/ipnTransfer.test.ts`: the two Arabic Instapay legs 6 minutes apart, same reference, different accounts, same device → one Transfer, no income row. Fails today.
- **Effort / risk:** M · a bank reusing a reference for an unrelated movement within 24 hours; guarded by opposite direction, different accounts and the fee tolerance.
- **Related:** QA-34.

### QA-39 · SMS-013 · The prompt-injection SMS was learned as an active template
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high (code); the live template row was not checked
- **Evidence:** Learning is queued the moment the AI answers, on three conditions only: `is_transaction`, a routing key, and the model's own `confidence >= 0.9` (`route.ts:994-1001`, `PATTERN_LEARN_CONFIDENCE` at `:108`). That is before every hold decision further down (`:1100-1136`), so even a message later held for the user is learned. The existing gates do not stop it:
  - Learn gates (`src/lib/sms/learnGates.ts:74-170`) check that the regex reproduces the AI's amount/currency/last4, is not greedy, and holds no per-user literal. They test the regex against the AI, never the AI's reading against anything, so an AI that was fooled is agreed with.
  - The wording guard lists refund/decline/future words only (`src/lib/sms/wordingGuard.ts:10-22`).
  - A new template is inserted with the column defaults `status 'active'`, `tier 'template'` (`route.ts:575-588`; `supabase/migrations/0097_sms_template_states.sql:71,120`), so its contributor parses with it at once (`partitionByScope`, `src/lib/sms/templateScope.ts:96-114`). There is no supervised or shadow start.
  - Quarantine and the adjudicator act only after a failure signal: a user edit or delete, the zero-variance check, or a shadow disagreement (`src/lib/sms/runAdjudication.ts:75-183,271-287`). All of them come after bookings.
  What does limit it: the template reaches only the user whose phone received the SMS until at least two users and the age/match floors promote it (`0246_…promotion_floor.sql:82-90`, `0264`); the regex keeps the injection wording as literals, so it matches only repeats of that text; a credit from a present but unknown sender id is held (`ingestGuards.ts:183-194`; the audit used "CIB", and iOS sends no sender). The lasting harm is that for that user the same text is booked with no AI call, so hardening the AI prompt for QA-14 does not close it.
  Not checked: whether template `42e20b95…` still exists in the live `sms_tracking_templates_ai` (the brief limits me to catalog reads).
- **Fix plan:**
  1. `route.ts`: move the learn scheduling from `:990-1001` to after the dispatch result, and call `learnPattern` only when the message was booked with no hold (not `holdForReview`, not `senderHeld`/`capHeld`, not `awaiting_confirmation`). Whatever hold QA-14 adds for an AI-only credit then also stops the learning, with no second rule.
  2. If QA-14 is fixed by prompt hardening only (no hold), add here: an AI-parsed credit kind (`income`, `instant_transfer_in`, `refund`) is never learned. Credit formats then become templates only through curated patterns; cost is one AI call per such message.
  3. Data: if the template row still exists, set its `status` to `retired`. C1 then blocks the same regex from being stored again (`route.ts:544-547`).
  4. No migration.
  5. Test: `src/lib/sms/__tests__/learningFunnel.test.ts` or `route.test.ts`: the injection body with the model mocked to return income at confidence 1 → no insert into `sms_tracking_templates_ai`, `learn_status` is a skip. Fails today.
- **Effort / risk:** S (step 1) · templates for held messages are learned one message later; step 2 raises AI cost for incoming-transfer formats.
- **Owner question:** Please confirm whether template `42e20b95…` was deleted in the audit cleanup; if not it should be retired now.
- **Related:** QA-14 (root cause; ship together), QA-36.

### QA-103 · SMS-008 · HSBC English ATM pattern is switched off (verified:false)
- **Verdict:** NOT-A-BUG · ticket P3 → backlog improvement · confidence high
- **Evidence:** The flag is the library's rule, not an oversight: "Only verified patterns (backed by a real SMS sample) are matched" (`src/lib/sms/patterns/types.ts:5,39`; enforced at `src/lib/sms/patterns/index.ts:63`). `hsbc-atm-withdrawal` is the one HSBC pattern with no captured sample in its comment (`hsbc.ts:50-59`), unchanged since the first commit `7cf2d73e`. An unverified regex that is wrong would book a wrong amount for every user with no AI check, so off is the safe state. The AI booked the test message correctly, and after one AI parse the learner stores a template for that shape (`route.ts:994-1001`), so the cost is not one call per message. Backlog action: when a real HSBC ATM SMS is captured, check the regex against it, set `verified: true` and add it to `patterns.test.ts`.
- **Effort / risk:** S once a real sample exists · none until then.
- **Owner question:** Do you have a real HSBC ATM withdrawal SMS? With one this is a ten-minute change; without one it should stay off.

### QA-104 · SMS-009 · One balance-only wording gets past the pre-filter and costs an AI call
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `BALANCE_ONLY_RE` matches "available balance", but the message is rejected only if no amount remains after the balance clauses are stripped (`src/lib/sms/patterns/preFilter.ts:131`). The clause pattern needs "balance" followed directly by "is" or ":" and the amount (`preFilter.ts:75`), so in "available balance on account ***9044 is EGP 12,450.10" nothing is stripped, the amount counts as a transaction amount (`preFilter.ts:100-108`) and the text goes to the AI. The cost is bounded: once two accounts, or three messages over two days, have had the AI reject the same masked shape, it is rejected with no AI call (`src/lib/sms/negativeCache.ts:29-35`, `route.ts:924-930`).
- **Fix plan:**
  1. `preFilter.ts:75` (first entry of `BALANCE_CLAUSE_PATTERNS`): allow an optional "on/in/of/for (your) account|card|a/c <mask>" between "balance|limit" and "is". The same list feeds the learn gate that rejects an amount captured from inside a balance clause (`learnGates.ts:130-137`), which gets the wider clause too.
  2. No migration.
  3. Test: `src/lib/sms/patterns/__tests__/patterns.test.ts` (pre-filter cases): the ticket's body → `balance_only`; "Account ***9044 was debited EGP 50.00. Available balance on account ***9044 is EGP 100.00" → not rejected.
- **Effort / risk:** S · a real transaction whose only amount sits in such a clause and that has no transaction verb would be rejected; none is known.

### QA-105 · SMS-010 · No built-in patterns for Banque Misr, "LE" or "ج.م"
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence high
- **Evidence:** Missing bank patterns are backlog, not a defect. Curated patterns ship only from real captured samples (`src/lib/sms/patterns/types.ts:5,39`), and an uncovered format is meant to go AI → learned template → free, which is what happened. There is no Banque Misr set in `ALL_PATTERN_SETS` (`src/lib/sms/patterns/index.ts:27-43`), but the brand is known for account naming (`src/lib/payment/paymentMethodDefaults.ts:218`). "LE" is already a recognised currency token (`src/lib/sms/patterns/currency.ts:28`, `preFilter.ts:105-106`).
  The one real defect is "ج.م": `CURRENCY_TOKEN_RE` knows "جنيه" and "جم" but not the dotted form (`currency.ts:27-28`), so `resolveCurrency` treats the currency as inferred and marks the row provisional (`src/lib/sms/currencyResolver.ts:41-44`); the user is asked to confirm a currency the message printed.
- **Fix plan:**
  1. `src/lib/sms/patterns/currency.ts`: add `ج\.\s?م` to `CURRENCY_TOKEN_RE` and `CURRENCY_AMOUNT_ALT`, with the same Arabic-letter boundary the "جم" entry uses. Add it to the Arabic branch of `hasNonBalanceAmount` (`preFilter.ts:107`).
  2. The phone gates keep their own copy of the list (`src/lib/sms/deviceOtpGate.ts`, `SmsGate.kt`, `SmsOtpGate` in `CatchBankSmsIntent.swift`; noted at `currency.ts:24-25`): update `deviceOtpGate.ts` now and the two native files with the next native build.
  3. No migration.
  4. Test: `src/lib/sms/__tests__/currencyParity.test.ts`: `hasCurrencyToken('تم خصم 250 ج.م')` is true; a "ج.م" message parsed as EGP is not provisional.
  5. Banque Misr and "LE" curated patterns: backlog, to be written from real samples in the corpus.
- **Effort / risk:** S · a false currency hit on Arabic text containing "ج.م" as an abbreviation of something else; unlikely next to an amount.


## 6.5 Sync and cross-domain

### QA-40 · SYNC-003 · Cash sentinel in pocket "held in" and savings deposit "from" columns
- **Verdict:** PARTIAL · ticket P2 → my severity P3 · confidence high
- **Evidence:** The mapper gap is real: `src/lib/supabase/remote/mappers/savingsAccountMapper.ts:46-47` and `savingsTransactionMapper.ts:23` forward the id unguarded (same in `debtPaymentMapper.ts:10`, `debtMapper.ts:79`, `accountAdjustmentMapper.ts:9`); the other mappers null-map `DEFAULT_CASH_ID`. But at HEAD no client path can put `pm_default_cash` into the two savings columns: `heldInPaymentMethodId` is never assigned on the client (only read back; the server sets it to a real account in `src/app/api/cron/month-carry/route.ts:142` and `src/lib/server/allocateGoalFunding.ts:97`); a savings transaction's `paymentMethodId` comes from `resolveAccountLeg` (`src/lib/savings/accountLeg.ts:13-22`, needs `isTracked`, and the sentinel can never get an opening balance: `src/lib/accounts/actions.ts:49-50`) or from `setAside` in `MoveMoneySheet.tsx:58`, whose account list uses `isOpenAccount` (`src/lib/accounts/kinds.ts:33`, excludes the sentinel); a pocket's `linkedPaymentMethodId` comes from `AddHoldingSheet.tsx:23,65` (bank, wallet, prepaid, debit only). Only a JSON import (`financeImportSchema.ts:375`) could carry it. The reachable sentinel leak is `debt_payments` only (QA-15, QA-50). "Then marks them delivered" is still true through the reconcile path (see QA-50).
- **Fix plan:**
  1. Add one helper next to the mappers (for example `serverPaymentMethodId(id)` in `src/lib/supabase/remote/mappers/`), returning `null` for an empty id or `DEFAULT_CASH_ID`. It is the expression already repeated in `expenseMapper.ts:23-24`, `incomeEventMapper.ts:41-42` and four others.
  2. Use it in `debtPaymentToRow` (`payment_method_id`), `savingsTransactionToRow` (`payment_method_id`), `savingsAccountToRow` (`linked_payment_method_id`, `held_in_payment_method_id`) and `debtToRow` (`linked_payment_method_id`). `account_adjustments.payment_method_id` is NOT NULL, so it cannot be null-mapped; its write site already redirects the sentinel to a real Cash account (`actions.ts:49-50`), leave it.
  3. No SQL migration.
  4. Test: in `src/lib/supabase/remote/__tests__/accountMappers.test.ts` (or `mappers/debtPaymentMapper.test.ts`), one case per mapper: an item whose id field is `pm_default_cash` maps to `null`. Fails today for all four.
  This one helper closes QA-15 and QA-40 and stops new QA-50 losses. It does not re-send rows already lost (QA-50 step 2) and does not fix the baseline bug (QA-16).
- **Effort / risk:** S · the server then holds `null` where the device holds the sentinel, and the device takes the server copy back on its next pull. For expenses that is harmless (null reads back as the sentinel, `expenseMapper.ts:60`). For a debt payment that has no companion expense, and for a savings transaction, an empty method means "moves no account" (`src/lib/accounts/balance.ts:103,113`), so on a user with a tracked Cash account the Cash balance would lose that leg. That is why QA-50 step 2 (store the real Cash account id at entry) ships with this helper; the helper is the safety net, not the whole fix.
- **Related:** QA-15, QA-16, QA-50 (ship together).

### QA-41 · SYNC-004 · Re-sending an unchanged row as an insert brings back a row another device deleted
- **Verdict:** CONFIRMED · ticket P2 → my severity P3 · confidence med (server behaviour certain, client trigger is a narrow window)
- **Evidence:** `emitList` sends every diff insert with `deleted_at: null` (`src/lib/supabase/remote/sync.ts:252-255`); a tombstone writes only `deleted_at` (`sync.ts:216`). The trigger `private.reject_stale_write` (latest body `supabase/migrations/0278_sms_server_rev.sql:17-50`) passes any write whose `edited_at` is unchanged and has an explicit branch that revives a tombstone even for an older edit (documented as REG-6 in `0241_newest_edit_wins_triggers.sql:7-8`). The client trigger the audit could not find exists: at a warm start the baseline is rebuilt from a stored fingerprint, and a cached row with no stored hash is treated as an insert (`src/components/sync/flushedFingerprint.ts:76-79`). The fingerprint is saved 300 ms plus idle time (up to 1.5 s) after the store (`SupabaseFinanceSync.ts:47-55`) and a failed save is swallowed (`flushedFingerprint.ts:92`). So a device closed in that window after pulling rows, or with full storage, re-inserts those rows on its next start (flush runs before pull, `SupabaseFinanceSync.ts:396-397`); if another device deleted one in between, it is live again for everyone. An offline edit of a deleted row is safe (updates do not send `deleted_at`).
- **Fix plan:**
  1. SQL migration (new, replaces `private.reject_stale_write`, keep the 0278 body otherwise): a write that would clear a tombstone (`old.deleted_at is not null and new.deleted_at is null`) is honoured only when `new.edited_at > old.deleted_at`; otherwise `new.deleted_at := old.deleted_at` (content still follows the normal rules). Apply to both the equal-`edited_at` branch and the REG-6 branch. It is a trigger function only, no new query or index.
  2. Client: undo-of-delete must carry a fresh stamp. Stamp `updatedAt` to now in `restoreExpense`, `restoreIncomeSource`, `restoreIncomeEvent`, `restoreDebtPayment` (`src/lib/store/useFinanceStore.ts:354,453,463,964`) and in `restoreRows` (`src/lib/buddgy/tools/exec/restoreKit.ts`, same pattern as its `putBack(..., stamp)`).
  3. Tests: `src/lib/supabase/remote/__tests__/reviveTombstone.test.ts` with `fakeEditTimeServer.ts` updated to the new rule: (a) an unchanged re-insert of a tombstoned row stays deleted (fails today), (b) an undo with a fresh stamp revives it (passes before and after).
- **Effort / risk:** M · any undo path left unstamped stops surviving sync (the row returns deleted on the next pull). Installed native builds that restore without a stamp lose undo-after-sync until rebuilt. This reverses the REG-6 decision from QA round 6, so the owner should agree.
- **Owner question:** REG-6 (round 6) chose "an undo of a delete always brings the row back, even with an old edit time". Fixing this needs "a delete can only be undone by an action newer than the delete". Accept that change, or keep REG-6 and accept the rare resurrection?
- **Related:** QA-107 (same family: a deleted row coming back from a stale device).

### QA-42 · SYNC-005 · After an admin data reset, a stale device writes its undelivered edits into the reset account
- **Verdict:** CONFIRMED · ticket P2 → my severity P3 · confidence high (code trace, not run)
- **Evidence:** `pendingSync` flushes first, then pulls (`src/components/sync/SupabaseFinanceSync.ts:396-397`); the reset verdict is read only inside the pull (`:578-590`, and `:621-631` on the fallback path). The warm start takes the same route (`:206-219`). A reset hard-deletes the rows and stamps `profiles.data_reset_at` (`src/lib/server/userData.ts:213-221,252`; called from `src/app/api/admin/users/[id]/route.ts:251`). The flush is an upsert, so each undelivered row is inserted again. Scope is limited to rows changed since the last delivered baseline, and rows whose parent was wiped fail the FK and are set aside; rows with no parent (payment methods, goals, expenses with no method) land in the reset account and then come back to every device.
- **Fix plan:**
  1. `SupabaseFinanceSync.ts`: lift the six-line reset check that `runLegacyFullSync` already has (`:621-631`: read `profiles.data_reset_at`, `decideReset`, wipe stores, clear cursors) into one local function and call it in `pendingSync` before `flush()`. Call it only when the store differs from `prevSnap.current` (slice reference compare), so a reconcile with nothing to send adds no request. A failed read counts as "no reset" so it never blocks a flush.
  2. No SQL migration.
  3. Test in `src/components/sync/financeSync.test.ts`: store holds one unsent expense, server profile carries a newer `data_reset_at`; expect no upsert call and an emptied store. Fails today (the upsert is sent).
- **Effort / risk:** S · one extra primary-key read on `profiles` per reconcile that has pending edits. An edit made on an online device in the seconds between the reset and its next pull is still written (debounced flush path); that is new data, not stale data, and is left alone.

### QA-43 · SYNC-006 · Two tabs: an edit made in tab B during tab A's persist write is lost
- **Verdict:** CONFIRMED · ticket P2 → my severity P3 · confidence med (code trace)
- **Evidence:** On another tab's write, this tab drops its queued persist write and rehydrates (`src/lib/store/useFinanceStore.ts:2463-2468`); the persist `merge` lets the stored copy replace memory (`:2411-2415`), so an edit not yet written (150 ms debounce, `:77`) disappears from memory. The comment says the sync layer re-sends it, but list edits are flushed 500 ms later from the live store (`SupabaseFinanceSync.ts:41,440-442,323`), which no longer holds the edit, so it is never sent. Profile and settings edits flush at once (`:433-438`) and survive. Window: the other tab's write must land within 150 ms after the edit; the other tab also writes after its own background pulls. Web only (native has one webview). `crossTabSync.test.ts` covers only the opposite direction (OFS-7).
- **Fix plan:**
  1. `src/lib/store/debouncedPersistStorage.ts`: add `hasPending()`.
  2. `useFinanceStore.ts` foreign-write handler: when `hasPending()`, take the list slices of the current state first, rehydrate, then fold them back with the existing `mergeList` (`src/lib/supabase/remote/merge.ts:28`, union by id, newer `updatedAt` wins) and let the normal persist write go out. With nothing pending, keep today's behaviour.
  3. No SQL migration.
  4. Test in `src/lib/store/crossTabSync.test.ts`: tab B adds an expense, tab A writes 100 ms later, timers advance; expect B's expense and A's row in B's store and in the stored blob. Fails today.
- **Effort / risk:** M · a delete made in tab B inside the same window is undone by the union (today the whole edit is lost, so no worse). Rows without an `updatedAt` stamp fall back to the stored copy.
- **Related:** E2E-007 (named in the ticket).

### QA-47 · X-001 · An SMS's printed date can push a purchase forward to the next day
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence med (code path certain; live rows and message bodies not read, so the reason the banks print the next day is not proven)
- **Evidence:** `resolveSmsDay` returns the body's day whenever it is "plausible", and plausible allows up to 2 days after the server's now (`src/lib/sms/ingestGuards.ts:15,92-96,111-117`); the capture day is never compared with it and no flag is set. The body day comes from `parseSmsDay`, which reads the date text only and ignores the time (`src/lib/sms/parseSmsDay.ts:79`), on the curated and template tiers (`src/app/api/sms/parse/route.ts:889,908,918`; the AI tier has no body day). `occurred_at` is the capture time (`src/lib/sms/createSmsExpense.ts:268`, `route.ts:729,1153`). A message cannot be received before its transaction, so a body day after the capture day is the bank's clock or posting date, not the purchase day. Both examples in the ticket are after 22:00 Cairo, which fits a bank printing in a timezone 2 hours ahead or a posting cut-off. The unit test at `ingestGuards.test.ts:69-70` only pins the 2-days-ahead bound with no capture day.
- **Fix plan:**
  1. `resolveSmsDay` (`src/lib/sms/ingestGuards.ts:111`): when both the body day and the capture day are plausible and the body day is later than the capture day, return the capture day (`source: 'capture'`, `unsure: false`). A body day equal to or earlier than the capture day still wins (delayed and offline deliveries keep working). No other caller changes: `route.ts:1025` is the only one, and the confirm route books `row.booked_day`, which this function produced.
  2. No SQL migration for the rule.
  3. Test in `src/lib/sms/ingestGuards.test.ts`: `resolveSmsDay({ bodyDay: '2026-11-01', captureDay: '2026-10-31', … })` gives day `2026-10-31`, source `capture`. Fails today (returns the body day).
  4. Optional repair of the existing rows (owner go-ahead needed, see question): a bounded one-off in the style of migration 0243, after a `SELECT` that lists the exact ids: set `expense_date` to the user-timezone day of `occurred_at` where it is exactly one day earlier, the row came from an SMS and the user has not edited the date.
- **Effort / risk:** S · a phone whose clock is a day behind would now date by its own wrong capture day where the bank's printed date was right (today the bank's date wins). Capture times are already trusted for every message that prints no date.
- **Owner question:** Repair the roughly 10 existing rows that were booked one day late (move them back to the capture day), or fix forward only?
- **Related:** QA-118 (same `occurred_at` versus booked-day pairing).

### QA-48 · X-003 · A mis-paired own transfer inflates spending, income and budget together
- **Verdict:** PARTIAL · ticket P2 → my severity P3 · confidence high
- **Evidence:** The described effect is accurate but it is not a defect of its own. An outgoing instant transfer that was not recognised as the user's own is booked as `Instapay` or `Remittance` on purpose ("An external send — still spend", `src/lib/sms/createSmsExpense.ts:64-67`); `Instapay` is deliberately outside `NON_SPEND_CATEGORIES` (`src/lib/constants/categoryMeta.ts:19-27`) because money sent to another person is spending, and `isReportSpendRow` (`categoryMeta.ts:44-45`) then counts it. The matching credit with no pair is income by definition. A recognised own transfer maps to `Transfer` and is excluded (`createSmsExpense.ts:60`). The user can already correct a miss (`src/app/api/sms/own-transfer/route.ts` confirm / confirm_account). What remains is the pairing miss itself, which is SMS-004 and SMS-012 (not in this slice).
- **Fix plan:**
  1. No change in the category or reporting layer: making `Instapay` non-spend would hide every real payment to another person.
  2. Fix the pairing in the SMS-004 / SMS-012 tickets; this ticket closes with them.
  3. When those ship, add one end-to-end assertion to their tests: after both legs of an own transfer are dispatched, month spend and month income are unchanged (one `Transfer` row, no income row). `src/lib/sms/pairingGuards.dispatch.test.ts` is the place.
- **Effort / risk:** S (the assertion only) · none in this layer.
- **Related:** SMS-004, SMS-012 (root cause).

### QA-49 · X-004 · A payday already marked received by hand makes the bank's salary SMS a second income
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high (code trace; live pattern not checked)
- **Evidence:** `matchSalary` picks the nearest payday inside the drift window (`payday_drift_days`, default 7, capped at half the payday gap, `src/lib/sms/matchSalary.ts:35,96-109`), then asks `firstUnfilledPayday`, which treats any live event on that `occurrence_date` as taken without looking at where it came from (`matchSalary.ts:232-249`). When every payday in range is taken it returns `create` (`:186-189`), and `dispatch.ts:766-767` books a new unlinked one-time income. The comment explains the intent: a second bank credit in the window is a bonus or correction. That holds when the first event came from an SMS; it does not hold when the user marked the payday by hand, which stamps `templateId` + `occurrenceDate` with no SMS link (`src/components/modals/AmountReceivedSheet.tsx:133-142`). Nothing later merges the two (`createSmsExpense.ts` has no adoption of a manual event; `possible_duplicate` in the parse route only covers a repeated message body). Order matters: SMS first, then a manual mark, is safe because the payday already shows received.
- **Fix plan:**
  1. `src/lib/sms/matchSalary.ts`: have `firstUnfilledPayday` also read `id, sms_log_id, amount, currency` for the taken paydays (same query, same index: `income_events_template_occurrence_uniq`). When the nearest payday is held by an event with `sms_log_id IS NULL` (hand-marked) and the SMS amount is within `EXACT_TOLERANCE` in the same currency, return a new decision `{ outcome: 'adopt', sourceId, occurrenceDate, eventId }`. Within `CONFIRM_TOLERANCE` return `confirm` carrying the same `eventId`. A payday held by an SMS-linked event keeps today's `create`.
  2. `src/lib/sms/dispatch.ts` (income branch, `:742-767`): on `adopt` (or a confirmed `confirm` with an `eventId`) update that event instead of inserting: set `sms_log_id`, the actual amount, `payment_method_id` when the SMS resolved one, and `occurred_at`. Reuse the income write in `createSmsExpense` by passing the existing id rather than adding a second writer. Service-role writes leave `edited_at` alone, so the device takes the server copy on its next pull.
  3. No SQL migration (columns and both unique indexes exist: `0082`, `0210`).
  4. Tests: `src/lib/sms/matchSalary.test.ts`: payday held by a manual event of the same amount gives `adopt` (today `create`); payday held by an SMS event still gives `create`. One dispatch test: after the SMS, the user has one income event for the payday, linked to the log.
- **Effort / risk:** M · a real bonus equal to the salary (within 2%) that arrives in the same window after a hand-marked payday would be absorbed into the payday instead of booked as extra income. The evidence score (`scoreSalaryEvidence`) can gate `adopt` the same way it gates `matched` to keep that rare.
- **Owner question:** When the hand-marked amount and the bank amount differ by 2 to 15 percent, should the bank amount replace the hand-entered one after the existing "is this your salary?" prompt, or silently?
- **Related:** none in this slice.

### QA-50 · X-005 · Default Cash chip + sentinel mapper = silent debt-payment loss
- **Verdict:** CONFIRMED · ticket P2 → my severity P1 (same defect as QA-15 on the default path) · confidence high (code trace; server answer `22P02` inferred from the uuid column, not run)
- **Evidence:** The chain holds at HEAD, and step 1 (two Cash methods) is not even needed. The built-in sentinel is the default method (`src/lib/store/defaultFinanceData.ts:30-38`, `isDefault: true`); the pay-debt sheet preselects `paymentMethods.find((m) => m.isDefault)` from the raw list, not from `pickablePaymentMethods` (`src/hooks/useAddDebtSheet.ts:148-150,325,616`), and the picker keeps a selected value even when it is hidden (`src/lib/accounts/kinds.ts:21-24`). The store saves the payment as given (`useFinanceStore.ts:815-870`); `debtPaymentToRow` sends `pm_default_cash` into the uuid column `debt_payments.payment_method_id` (`mappers/debtPaymentMapper.ts:10`, `supabase/migrations/0151_ledger_links.sql`). The row error is set aside (`sync.ts:91-92,158-161`). `flush()` now keeps a set-aside row unsent (`SupabaseFinanceSync.ts:341`, `parkedRows.ts:37`), but the next reconcile re-baselines to the whole store (`SupabaseFinanceSync.ts:398`, `flushBaseline.ts:4-6`, `flushed` is true because a set-aside row is not an error), so from the first resume, reconnect or pull-to-refresh the row counts as delivered and is never offered again. Locally nothing looks wrong because `resolveAccountId` maps the sentinel to Cash (`src/lib/accounts/resolve.ts:25`). The companion expense does reach the server (its mapper null-maps the sentinel, and `linked_debt_payment_id` has no FK), so the server ends with a "Debt" expense and an unreduced debt.
- **Fix plan:**
  1. The mapper helper from QA-40 (one function, used by `debtPaymentToRow` and the three other unguarded mappers). This alone stops new losses and closes QA-15 and QA-40.
  2. `useAddDebtSheet.ts:148-150,325,581,616`: pick the default from `pickablePaymentMethods(paymentMethods)` (existing helper, hides the sentinel once a real Cash account exists), and when the chosen id is still the sentinel store `cashAccountId(paymentMethods)` (`src/lib/accounts/resolve.ts:9`) if that is a real account. The server then gets the real Cash id whenever Cash is tracked; the null from step 1 only happens when no real Cash account exists, where nothing tracks the leg anyway.
  3. Re-send the payments already lost on devices: a persist migration (`PERSIST_VERSION` 22 → 23, `useFinanceStore.ts:76,2184`) that, for `debtPayments` with `paymentMethodId === 'pm_default_cash'`, sets the real Cash account id when one exists (else clears the field) and stamps `updatedAt`. The changed row no longer matches its stored fingerprint, so the next start sends it (`flushedFingerprint.ts:79`) and the upsert inserts it. Do not simply clear the field when a real Cash account exists: an expense-less payment with no method is skipped by the balance engine (`balance.ts:103`).
  4. QA-16 (other reviewer): in `pendingSync`, keep set-aside rows out of the new baseline (apply `holdParkedBack` there as `flush()` does). Without it any future row error is still lost silently after the next reconcile.
  5. No SQL migration.
  6. Tests: mapper case from QA-40; a store-migration test (v22 state with a sentinel debt payment comes out with no method and a new stamp); in `src/components/sync/financeSync.test.ts`, a set-aside row is still in the diff after `syncFinanceNow()` (fails today, belongs to QA-16).
- **Effort / risk:** S for steps 1 and 2, M with step 3 · step 3 relies on a stored fingerprint; a device with none (first start after a long-skipped upgrade) trusts its cache and would not re-send, so a few payments could stay local-only. A re-sent payment whose debt was deleted meanwhile fails its FK and is set aside (harmless).
- **Related:** QA-15 (same root), QA-16 (why it is silent), QA-40, E2E-005.

### QA-106 · SYNC-007 · Last-writer-wins applies to the whole row
- **Verdict:** NOT-A-BUG · ticket P3 → my severity P3 (design trade-off) · confidence high
- **Evidence:** Works as designed and documented. `docs/OFFLINE_GUIDE.md:37`: "If the same item was edited on two devices, the newest edit wins, by edit time"; the rule is per item, not per field. The server guard was built for exactly that in QA round 6 (`supabase/migrations/0241_newest_edit_wins_triggers.sql:1-8`, `docs/qa-round-6/closing-sync.md:23`: 300 seeds, three devices, "newest edit wins on every seed"). Mappers send full rows (`expenseMapper.ts`), and the device whose push was skipped pulls the newer row (`SupabaseFinanceSync.ts:345`). The ticket itself says "By design today". The one gap is that the losing device is not told its edit was replaced.
- **Effort / risk:** n/a (a per-field merge would be L: per-column edit times or a field-patch protocol on 21 tables, plus the trigger).
- **Owner question:** Keep "newest edit to the item wins" as documented, or invest in either (a) a small notice on the device whose edit was replaced, or (b) per-field merging? Recommendation: keep; consider (a) only.
- **Related:** E2E-006, E2E-008 (named in the ticket as the same suspicion).

### QA-107 · SYNC-008 · A device with a cursor over 60 days old keeps a row another device deleted if it edited the row later
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence med (code trace)
- **Evidence:** A cursor older than 60 days makes the server answer `needs_full` (`supabase/migrations/0300_db_load_phase_a.sql:125-126`); `pullDelta` then does a full pull with `staleBefore = since` (`src/lib/supabase/remote/delta.ts:104-107`). A local row missing from the server is dropped only when its `updatedAt` is at or before that cutoff (`delta.ts:145`), so a row the device edited after the cutoff stays. The flush that runs first sends the edit as an update without `deleted_at` (`sync.ts:256`), so while the tombstone still exists (90-day purge) the server row stays deleted and this device alone keeps showing it: totals differ between devices. After the purge the same upsert becomes an insert and the row is live again for every device. The timestamp rule is deliberate caution (`delta.ts:68-72`: do not drop what may be unsent work), which is why it survives.
- **Fix plan:**
  1. `src/lib/supabase/remote/delta.ts` `applyListWith`: on a full pull with `staleBefore` set and a `pending` set available (the delivered baseline was passed in), drop a local row that is absent from the server whenever it is not pending, whatever its `updatedAt`. The flush ran first, so anything not pending was delivered, and if the server does not return it, it was deleted there. Keep today's timestamp rule when there is no baseline (`pending` undefined) and always keep pending rows.
  2. No SQL migration.
  3. Test in `src/lib/supabase/remote/delta.test.ts`: local row edited after `staleBefore`, already delivered (equal to the baseline), absent from the full pull: expect it removed (kept today). Second case: same row but pending: kept.
- **Effort / risk:** S · the rule trusts the delivered baseline. Today a row can be in the baseline without ever reaching the server (QA-16: a set-aside row after a reconcile; also a first start with no stored fingerprint, `flushedFingerprint.ts:96-104`), and this change would then delete such a row locally on a full pull. Do not ship it before QA-16. The post-purge resurrection (device offline more than 90 days and edited the row) is not covered and is not worth more machinery.
- **Related:** QA-41 (same family), QA-16 (the "delivered" baseline must be right for step 1 to be safe: fix QA-16 first).

### QA-118 · X-002 · Manual and SMS money take different timing paths on the same day
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high (code trace)
- **Evidence:** The balance engine reads a row at its `occurredAt`, else at noon of its day (`src/lib/accounts/balance.ts:39-43`), and ignores rows at or before the account's opening instant or after "now" (`balance.ts:66`). SMS rows always carry the capture time (`src/lib/sms/createSmsExpense.ts:268,647`). Manual expenses dated today are stamped since 2026-10-23 (`src/lib/store/useFinanceStore.ts:278`), but manual income is not (`addIncomeEvent`, `useFinanceStore.ts:501-511`; borrowed-money income `:404-420`), nor are debt payments and the expense written with them (`addDebtPaymentWithExpense` `:815-854`, `addDebtPayment` `:856-870`). So money logged by hand before noon is not in the balance until 12:00, and on the day the account was opened after noon it is never counted. The mappers already carry the field (`incomeEventMapper.ts:50`, `debtPaymentMapper.ts:23`).
- **Fix plan:**
  1. `useFinanceStore.ts`: apply the rule already used by `addExpense` (`:278`: keep a given `occurredAt`, else stamp now when the row's day is today) in `addIncomeEvent` (day = `receivedDate`), the borrowed-money income, `addDebtPayment`, and both rows of `addDebtPaymentWithExpense`.
  2. `src/components/modals/AmountReceivedSheet.tsx:133`: when an expected payday is marked received today through `updateIncomeEvent`, pass `occurredAt` the same way.
  3. No SQL migration (`occurred_at` exists on all three tables).
  4. Test in `src/lib/accounts/balance.test.ts` plus a store test: an income added at 09:00 today on a tracked account is in `computeBalances` at 09:01 (fails today: it appears at 12:00); an income added at 15:00 on an account opened at 14:00 the same day is counted (never counted today).
- **Effort / risk:** S · back-dated entries stay at noon as now. Rows already saved without a time are not changed.
- **Related:** E2E-002 (same root; one change closes both), QA-47.

### QA-119 · X-006 · The Budget Studio's savings answer is dropped if any pocket already exists
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high (code trace)
- **Evidence:** `commitFlowEntities` creates the savings pocket only when `store.savingsAccounts.length === 0` (`src/lib/budget/studioEntities.ts:57-62`). Skipping when the user already tracks pockets is deliberate and documented (`studioEntities.ts:35-39`: "what the user typed in words must not double what they already track"). The defect is narrower: the app itself seeds an empty "Monthly Savings" vault the first time Wealth opens (`src/hooks/useEnsureMonthlySavingsVault.ts:15-34`, called from `src/app/(app)/wealth/page.tsx:62`), and the server creates the same vault in the month-carry job (`src/app/api/cron/month-carry/route.ts:142`). That system pocket holds nothing, yet it makes the guard skip the user's answer with no message. The existing test only covers "a real pocket exists" (`studioEntities.test.ts:80`).
- **Fix plan:**
  1. `src/lib/budget/studioEntities.ts:58`: count only pockets that track something: ignore a pocket of `type === 'vault'` with `currentBalance === 0` (the seeded carry vault) when deciding whether savings are already tracked. The rest of the rule stays.
  2. No SQL migration.
  3. Test in `src/lib/budget/studioEntities.test.ts`: store holds only an empty vault, answer `savingsOnHand: 5000`; expect `created.savings` set (fails today). Keep the existing "real pocket exists, nothing created" case.
- **Effort / risk:** S · a user who made their own empty vault and then answers the question gets one extra pocket holding the stated amount, which is what they asked for.
- **Related:** QA-001 (pocket logic, named in the ticket).

### QA-120 · X-007 · SMS credits to an unregistered last4 stay unassigned after a provisional account for it appears
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence med (code trace; live rows not read)
- **Evidence:** True that nothing adopts earlier rows: `ensureProvisionalAccount` only inserts the method (`src/lib/sms/accountPlacement.ts:75-117`), and the client's "place unassigned" list covers expenses only (`src/lib/accounts/unplacedSms.ts:8-12`); an unassigned income can only be fixed one at a time in `EditIncomeEventSheet`. Provisional accounts shipped on 2026-11-14 (`fe9dee68`), which matches the ticket's dates: the 15 rows are credits booked before the feature existed. Going forward a credit creates or reuses the provisional account itself (`createSmsExpense.ts:493-496,525`), so new gaps only occur when the first message lacked a bank or currency. The balance claim is wrong: the engine ignores every row at or before the account's `openingAt` (`src/lib/accounts/balance.ts:66`) and a provisional account is untracked until the user sets a balance, which is taken after those credits. Only the account's history list and the detected-account row count miss them.
- **Fix plan:**
  1. `src/lib/sms/accountPlacement.ts` `ensureProvisionalAccount`: after a successful insert (not on the "already exists" path), adopt this user's earlier unassigned SMS rows for the same digits and currency: read the matching log ids from `sms_parse_log` (`user_id`, `account_last4`, same currency, same bank when the log names one; index `sms_parse_log_user_tail` from migration 0265; `LIMIT` a few hundred), then one `UPDATE income_events SET payment_method_id` and one for `expenses`, each `WHERE user_id = … AND payment_method_id IS NULL AND sms_log_id IN (…)`. `EXPLAIN` both on the live database first.
  2. Existing rows: a bounded one-off in a migration, after a `SELECT` that lists the exact ids (about 15 rows, 4 users), owner go-ahead needed.
  3. Tests next to `accountPlacement` tests: creating the provisional account assigns an earlier unassigned credit with the same digits and currency, and leaves one with other digits or another bank alone.
- **Effort / risk:** M · adopting the wrong rows when two of the user's banks share the same last digits and the old log names no bank; require a bank match whenever the account has one. The server write does not move `edited_at`, so devices take it on the next pull.
- **Owner question:** The effect is history only (balances are anchored at the opening balance). Worth doing the adoption (step 1), only the one-off repair (step 2), or neither?
- **Related:** none in this slice.


## 6.6 Functional, P2

### QA-18 · E2E-005 · Onboarding Cash creates a second Cash account
- **Verdict:** PARTIAL · ticket P2 → my severity P3 · confidence high
- **Evidence:** The second row is deliberate: the built-in `pm_default_cash` has a non-uuid id, is never synced and cannot hold a balance, so tracking cash creates one real "Cash" row (`src/lib/accounts/actions.ts:15-24`, called from `src/components/features/accounts/AddAccountSheet.tsx:82-86`; a second tap reuses it). Money paid with either id lands on the same account (`src/lib/accounts/resolve.ts:23-24`), so balances are right. What is wrong is the display. `pickablePaymentMethods` exists to hide the built-in one once a real Cash exists (`src/lib/accounts/kinds.ts:18-25`) but (a) several lists do not use it: debt-payment chips (`src/components/features/debts/redesign/PayDebtForm.tsx:70`, fed raw from `src/hooks/useAddDebtSheet.ts:82`), subscription set-up (`src/components/features/subscriptions/AddConfigureStep.tsx:165`), voice recap (`src/components/voice/VoiceRecapEditor.tsx:201`), expense filters (`src/components/expenses/ExpenseFilters.tsx:374`); and (b) forms pre-select the method flagged `isDefault`, which is the built-in one (`src/hooks/useAddExpenseSheet.ts:65`, `useAddDebtSheet.ts:149`), and the picker always keeps the selected id (`kinds.ts:24`, `PaymentMethodPicker.tsx:41`), so both "Cash" show in the expense picker too. The "1 live user with 2 live Cash rows" cannot come from this path (the built-in is never written to the server); it would need two devices each creating a real Cash before syncing. Not checked: user-data tables are off limits.
- **Fix plan:**
  1. `src/lib/accounts/resolve.ts`: add `defaultMethodId(methods)` = the `isDefault` method, but the real Cash (`cashAccountId`) when that default is the built-in one and a real Cash exists. Use it at the pre-select sites (`useAddExpenseSheet.ts:65,136`, `useAddDebtSheet.ts:149,325,581,616`, `useAddSubscriptionForm.ts`, `useRecurringDebtPaymentSheet.ts`, `IncomeSheetForm.tsx`).
  2. Run the unfiltered lists through the existing `pickablePaymentMethods(methods, selectedId)`: `PayDebtForm.tsx:70`, `AddConfigureStep.tsx:165`, `VoiceRecapEditor.tsx:201`. Leave `ExpenseFilters` for the owner's decision in QA-15/QA-40/QA-50 (old rows carry the built-in id, so the filter needs one merged "Cash" entry, not a hidden one).
  3. No SQL migration. Tests: `src/lib/accounts/__tests__/actions.test.ts` (or a new resolve test), "the default method is the real Cash once it exists"; a render test for `PayDebtForm` with built-in + real Cash expecting one "Cash" chip (fails today: two).
- **Effort / risk:** M · pre-select sites are many; a missed one keeps the duplicate in that form only. Editing an old expense that carries the built-in id still shows it as selected (by design of `keepId`).
- **Related:** QA-26 (Buddgy cannot match "cash" when two methods share the name), QA-15 / QA-40 / QA-50 (Cash-sentinel theme, other reviewers; link only). The onboarding rebuild (prototype) would replace `StepAccounts`, but the cause sits in the shared add-account sheet and pickers.

### QA-19 · E2E-006 · Onboarding journey jumps back a step (intermittent)
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence med (mechanism proven in code; not reproduced, the trace is not on this machine)
- **Evidence:** The journey step and the entered name both live on the synced profile (`src/components/features/onboarding/useOnboarding.ts:14-20`, `StepAbout.tsx:38-42`). Two races let an older profile replace the newer one. (a) A pull takes the server profile wholesale whenever the row changed since the cursor: `src/lib/supabase/remote/delta.ts:188` (`profile: profileResult?.profile ?? local.profile`), and during onboarding the user's own writes make it "changed" on every pull (`supabase/migrations/0233_sync_pull_deleted_activations.sql:27`, `updated_at > win`), so the probe added in 67e8e03d/38595dce does not skip it. Any profile edit made between the flush snapshot and the merge inside `pendingSync` (`src/components/sync/SupabaseFinanceSync.ts:384-407`, merge at `:593-594`) is overwritten, then the baseline is reset to the reverted store (`:398`). The "re-snapshot before the merge" comment only protects list rows. (b) Profile flushes are not serialised: every profile/settings change calls `void flush()` at once (`SupabaseFinanceSync.ts:427-438`), and `StepAbout.save` makes three changes in one tick (name, currency, step), so three full-row profile upserts are in flight together. `profiles` has no newest-edit guard (not in the 0241 trigger list, no `edited_at` sent by `profileMapper.ts`), so if the step-0 upsert lands last the server keeps step 0 and the next pull brings it back. The 30 s resume throttle only limits one of the pull triggers (resume); warm start, reconnect, stale-write re-pull and the SMS nudge are unchanged.
- **Fix plan:**
  1. `src/lib/supabase/remote/delta.ts` `applyDelta`: when `delivered` is given and the local profile (plus `financialGoalsNotes`, `activeBudgetPlanId`, currencies) differs from `delivered` (use the existing `diffSingleton` from `./diff`), keep the local profile and extras; same rule for `settings`. The undelivered edit then goes out on the next flush. No SQL migration.
  2. `src/components/sync/SupabaseFinanceSync.ts` `flush`: allow one flush in flight; a call that arrives meanwhile sets a "run again" flag and the running flush loops once more with a fresh snapshot (same pattern as `reconciling`/`runAgain` at `:388-403`). This puts profile upserts on the server in order.
  3. Tests: `src/lib/supabase/remote/delta.test.ts`, new case "keeps a local profile edit the server has not received when an older server profile comes down" (fails today: server profile wins). `src/components/sync/financeSync.test.ts`, new case "two store changes in one tick send their writes one after the other" (fails today: two overlapping `flushDiff` calls).
- **Effort / risk:** M · core sync path: a wrong "pending" test would keep a stale local profile over a real change from another device (settings toggles, active plan); sign-out's final flush must still resolve when a flush is already running.
- **Related:** QA-20 and QA-65 (same pull/merge window in `runFullSync`); SYNC-007 family named in the ticket. The onboarding rebuild (prototype, not approved) would replace `StepAbout` and the journey screens, but the race is in the sync layer and would survive it.

### QA-20 · E2E-008 · Goal funded to 100% stays active (intermittent)
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence med (mechanism proven in code; which pull fired in the E2E run cannot be told without the trace)
- **Evidence:** The deposit marks the goal achieved locally in the same store update (`src/lib/store/useFinanceStore.ts:1801-1804` → `src/lib/goals/reconcileAchievedGoals.ts:26`), but the flip does not move `updatedAt` (goals are not in `STAMPED_SLICES`, `src/lib/supabase/remote/stampEdits.ts:8`; `achieveGoal` at `useFinanceStore.ts:1395-1402` has the same gap). On a pull the local row and the server row then carry the same edit time (`goalMapper.ts:89`, `updatedAt = edited_at`) and a tie goes to the server: `src/lib/supabase/remote/merge.ts:41` (`lt > st + margin`). So a pull whose server read happened before the "achieved" flush committed (the flush is debounced 500 ms, and a reconcile is flush + probe + pull, three round trips) puts the goal back to `active`; the baseline is then reset to that state (`SupabaseFinanceSync.ts:398`), so "achieved" is never sent. The card and the celebration read live progress, not status (`GoalCelebrationListener.tsx:60-62`), which is why the screen says 100% and "You did it!" while the goal stays under Active. It heals only when a later store action runs the reconcile again.
- **Fix plan:**
  1. `src/lib/goals/reconcileAchievedGoals.ts`: set `updatedAt: iso` on the goal it flips to achieved. `src/lib/store/useFinanceStore.ts` `achieveGoal`: same stamp. The local row then wins the merge and the server's newest-edit trigger (0241) sees a newer edit. No SQL migration.
  2. Tests: `src/lib/goals/goalLogic.test.ts` (or a new `reconcileAchievedGoals.test.ts`), "a goal that reaches its target gets a new updatedAt"; `src/lib/supabase/remote/delta.test.ts`, "a goal achieved locally survives a pull that still carries the active server copy" (fails today: server copy wins the tie).
- **Effort / risk:** S · a goal achieved on one device now beats an older edit of the same goal made on another device within the same window (acceptable: newest edit wins is the rule everywhere else).
- **Related:** QA-19 (same pull window; fix 1 there does not cover list rows, this stamp does). Any other status flip done inside a reconcile without a stamp has the same weakness (debts cleared by `settleDebt` are worth a look in the same change).

### QA-23 · QA-019 · Budget draft debt chips swapped/aggregated; plan below debt minimums
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high (the ticket's numbers fall out of the code exactly)
- **Evidence:** The builder plans from the *answered* debts, whose ids are `answered-family`, `answered-bnpl` (`src/lib/budget/flow/toFacts.ts:149-166`), while it creates real debt records with new ids (`src/lib/budget/studioEntities.ts:65-73`); the plan lines keep `linkIds: ['answered-…']` and are never re-pointed at the records (`src/components/features/budget/studio/StudioPage.tsx:137-166`, comment at `:139`). On save the mapper drops non-uuid link ids (`src/lib/supabase/remote/mappers/budgetPlanMapper.ts:71-72`), so after one sync round trip both lines are "debts, no ids". For such a line the live amount is the total of *all* unclaimed debts (`src/lib/budget/planView.ts:106,116`), and the chip shows live minus planned (`planView.ts:152`, `lineStatus.ts:83-84`): 1,750 − 0 = 1,750 on "Family and friends" and 1,750 − 500 = 1,250 on "Instalments". Not swapped: each line is compared with the sum of both. Tapping Update on both would plan 3,500 against 1,750 of minimums. The plan-below-minimums part has its own cause: with no monthly payment answered, the fact's minimum is 0 so the line is planned at 0 (`toFacts.ts:160`, forced by `validate.ts:79-85`), but the debt record is created at balance/12 a month (`studioEntities.ts:67`). Side effect: payments are not counted against these lines (`src/lib/budget/lineSpend.ts:61,71` need link ids).
- **Fix plan:**
  1. `src/lib/budget/studioEntities.ts`: add `relinkDraft(draft, created)` that replaces each `answered-…` id in `linkIds` with the id in `created['debt:…']` / `created['goal:…']`, and turns a line whose answered fact has no record into `linkType: 'none'`. Call it in `StudioPage.tsx` on `final` before `draftToCategories`.
  2. One payment rule for both sides: export the `d.minimum > 0 ? d.minimum : Math.ceil(d.balance / 12)` rule from `studioEntities.ts` and use it for the answered fact's `minimum` in `toFacts.ts` `answeredDebts`, so the line and the debt record carry the same amount (needs the owner's answer below).
  3. `src/lib/budget/planView.ts` `liveAmountOf`: when more than one debts line has no ids, return `null` for them (no live comparison) instead of giving each the grand total; a single id-less line keeps today's behaviour. Same for goals. This also stops the wrong chips on plans already saved.
  4. No SQL migration (`link_ids` is already `uuid[]`). Tests: `src/lib/budget/studioEntities` test, "a line for an answered debt links to the debt record created from it"; `planView` test, "two debt lines without ids are not each compared with the total of all debts" (both fail today).
- **Effort / risk:** M · step 2 raises the planned debt amount in new drafts, which squeezes the other lines; step 3 hides a (wrong) chip on existing plans rather than repairing their links.
- **Owner question:** When someone says they owe family or friends money but gives no monthly payment, should the plan budget balance ÷ 12 a month (what the debt record already assumes) or leave the line at 0 and only show the debt? Options: balance ÷ 12 in both (recommended) / 0 in both.
- **Related:** The Budget Builder rebuild (v5 prototype, not approved) would replace `StudioPage` and the flow that creates these lines; steps 1-2 sit on that surface, step 3 (`planView`) would survive it.

### QA-24 · QA-021 · Reports month-by-month shows expected income as Money in
- **Verdict:** PARTIAL · ticket P2 → my severity P3 · confidence high
- **Evidence:** The number is the deliberate "expected" figure, not a calculation error: the chart and table take `incomeForCycle(cycle, false)` (`src/hooks/useReportsPage.ts:116`), which is received money plus the projected amount for paydays with no event yet (`src/lib/utils/calculations.ts:201-220`, "assume received unless explicitly marked missed"). The summary card on the same page shows that same figure correctly split as "Money in (expected)" with "Received so far" under it (`src/components/features/reports/ReportsSummaryPanel.tsx:46-52`, from `useReportsPage.ts:78-82`). What remains is the label: the chart legend and the table header call it plain "Money in" (`src/components/reports/MonthlyChart.tsx:74,82`, `en.ts:1659`) next to "Money out" and "Saved", which are real money. So the screen breaks the two-number rule in wording only: 5,000 expected reads as 5,000 received.
- **Fix plan:**
  1. `src/components/reports/MonthlyChart.tsx`: use the existing `t.reports.kpiTotalInExpected` ("Money in (expected)", already translated) for the bar name and the table column header instead of `chart.moneyIn`. No new string, no SQL migration.
  2. Optional, if the owner picks option B below: add `received` to `monthlyData` (`incomeForCycle(cycle, true)`, already computed for the summary) and a "Received" column in the `ChartDataTable` rows.
  3. Test: extend the Reports render/hook test to assert the month table header is the expected-income label (fails today: "Money in").
- **Effort / risk:** S (label) / M (extra column) · a longer legend label on a narrow phone chart; check wrapping in Arabic.
- **Owner question:** In the month-by-month chart, should "Money in" (A) stay the expected figure and be labelled "Money in (expected)" (recommended, smallest), (B) show both expected and received per month, or (C) show received only? Closed months also count unmarked paydays as received by rule, so C would change past months too.
- **Related:** none in this slice.

### QA-25 · QA-023 · Buddgy net-worth explanation does not add up
- **Verdict:** CONFIRMED · ticket P2 → my severity P3 · confidence high
- **Evidence:** The total is right; the parts handed to the model are incomplete. Net worth is `savings + investments + (accounts total, else this month's flow) − debt` (`src/lib/savings/netWorth.ts:78`). The `get_net_worth` tool returns `net_worth`, `savings`, `investments`, `debt` and `month_flow` but never the accounts total (`src/lib/buddgy/tools/exec/savings.ts:126-134`; `accountsTotal` exists on the result, `netWorth.ts:97`). With tracked accounts the 680 is inside `net_worth` and `month_flow` is *not*, so the model can only explain −15,220 as 1,600 − 17,500. The tool description repeats the wrong recipe ("savings, investments, debt and this month flow", `src/lib/buddgy/tools/specs/savings.ts:19`). The later Buddgy turn changes (cf71a756, 767f39ba) did not touch this payload (last change to the file: 67b560b0). Whether 1,600 wrongly includes the linked QNB pocket is QA-013 (another reviewer), not this tool.
- **Fix plan:**
  1. `src/lib/buddgy/tools/exec/savings.ts` `get_net_worth`: when `nw.accountsTotal` is not null return `accounts: r0(nw.accountsTotal)` and leave `month_flow` out; otherwise keep `month_flow`. The returned parts then always sum to `net_worth`.
  2. `src/lib/buddgy/tools/specs/savings.ts:19`: description "Net worth and its parts: savings, investments, accounts (or this month's flow when no account is tracked), minus debt. The parts add up to net_worth."
  3. No SQL migration. Test in `src/lib/buddgy/tools/__tests__` (savings read tools): "get_net_worth parts add up to net_worth with a tracked account" (fails today: 680 missing).
- **Effort / risk:** S · a model answer that used `month_flow` for "how much did I spend" must get it from the spending tool instead; check the Buddgy eval prompts that mention net worth.
- **Related:** QA-013 (pocket counted in savings; fix separately, this change stays correct either way).

### QA-26 · QA-024 · Buddgy quick add saves the raw prompt as description
- **Verdict:** CONFIRMED · ticket P2 → my severity P3 · confidence high
- **Evidence:** Traced "Add a coffee for 45 paid with cash" through `src/lib/buddgy/local/parseQuickAdd.ts` (unchanged since c7a995ea). `LEADING_NOISE` (`:47-49`) has no "add/log/a/an", so `tidy` (`:107-114`) strips nothing from the front. `extractMethod` (`:91-105`) returns the text untouched when more than one method matches with the same name (`:103`, `longest.length !== 1`), so "paid with cash" stays and no method is set (the expense falls back to the default method, which happens to be Cash). The name tie is common, not an edge case: the caller passes every payment method, including the built-in Cash and closed ones (`src/lib/buddgy/client/localTurn.ts:41`), so any account that tracks cash has two "Cash" names.
- **Fix plan:**
  1. `src/lib/buddgy/client/localTurn.ts:41`: build the list from the existing `pickablePaymentMethods(s.paymentMethods)` (`src/lib/accounts/kinds.ts:22`), which hides the built-in Cash once a real one exists and drops closed accounts. "with cash" then matches one method and is stripped.
  2. `parseQuickAdd.ts` `extractMethod`: on a real tie (two open methods with the same name) still strip the matched phrase from the text and leave `ref` unset.
  3. `parseQuickAdd.ts` `LEADING_NOISE`: add `add|log|record|a|an|the` (and the Arabic `ضيف|اضف|سجل`).
  4. No SQL migration. Tests in `src/lib/buddgy/local/__tests__/parseQuickAdd.test.ts`: "add a coffee for 45 paid with cash" → description "coffee", method set; the same with two methods named Cash → description "coffee", no method (both fail today).
- **Effort / risk:** S · stripping "a/the" could shorten a description that really starts with one ("A&W", "The Body Shop"): the pattern only matches whole words, so "A&W" is safe, "The Body Shop" becomes "Body Shop"; drop `the` if that matters.
- **Related:** QA-18 (two "Cash" methods is what triggers the tie); step 1 uses the same helper QA-18 extends.

### QA-63 · E2E-003 · Withdraw sheet "What is it for?" options have no accessible names
- **Verdict:** NOT-A-BUG · ticket P3 → my severity none · confidence med (read from code and the ARIA naming rules; not run in a browser or with a screen reader here)
- **Evidence:** Each option is a `<button role="radio" aria-checked>` (`src/components/ui/SelectableCard.tsx:100-114`) inside `role="radiogroup" aria-label="What is it for?"` (`src/components/features/savings-v3/WithdrawSheetV3.tsx:234`), and it contains its visible title and subtitle as text (`:238-241`; the icon is decorative). The `radio` role takes its accessible name from its content, so the five options are named "Spending …", "Pay a debt …" and so on without an `aria-label`; adding one is not required and would hide the subtitle. The ticket's reasoning ("no `aria-label` or `aria-labelledby`") is the usual false positive for name-from-content roles; a test that looks the option up by the exact name "Spending" would also miss, because the name includes the subtitle. The same component is used for 20-odd other choice lists, none flagged.
- **Effort / risk:** none. A 5-minute check closes the doubt: in the E2E suite, `getByRole('radio', { name: /Spending/ })` inside the Withdraw sheet should resolve; or listen once with VoiceOver/TalkBack.
- **Related:** none.

### QA-64 · E2E-004 · Floating Buddgy button announced as "Set up your budget"
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `src/components/ai/AIChatBubble.tsx:160-161` uses `t.modals.fabAskAi` for both `title` and `aria-label`; the value is `'Set up your budget'` (`src/lib/i18n/dictionaries/en.ts:2240`) and `'إعداد الميزانية'` in Arabic (`ar.ts:2247`), so both languages are wrong. The key has no other user. The button opens Buddgy for everyone (`onOpen()`), budget or not. Second part also true: the desktop sidebar `<nav>` has no accessible name (`src/components/layout/Sidebar.tsx:83`).
- **Fix plan:**
  1. `src/lib/i18n/dictionaries/en.ts:2240` → `fabAskAi: 'Ask Buddgy'`; `ar.ts:2247` → `'اسأل Buddgy'` (the wording already used at `en.ts:3124` / `ar.ts:3136`). Label fix only, same look.
  2. `src/components/layout/Sidebar.tsx:83`: add `aria-label={t.common.mainNavigation}`, the string the mobile bar already uses (`src/components/layout/BottomNav.tsx:47`).
  3. Test: in `src/lib/i18n/buddgyChatCopy.test.ts`, assert `modals.fabAskAi` names Buddgy in both languages (fails today). No behaviour test needed.
- **Effort / risk:** S · none beyond copy; E2E selectors that look the button up by the old name would need the new one.
- **Related:** UI-008, UI-013 (named in the ticket; other reviewers).

### QA-65 · E2E-007 · Finance store stays in localStorage after sign out (intermittent)
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence med
- **Evidence:** Two things, only the second is a defect. (1) By design the login screen appears before the wipe: `signOut` clears the user first (`src/components/auth/AuthProvider.tsx:440-441`) and only calls `clearBudgetData()` after awaiting the final flush, the biometric unbind and the local sign-out (`:458-463`). With an unsent edit (an expense added under 500 ms earlier) that is one or more network round trips, so a check made "right after the login screen appeared" sees the old store; it is gone once the flush returns. This matches the 2 failures and the 6 clean 10-second probes. The final flush has no timeout, so on a stalled connection the store (and the session token) stay until the request fails. (2) Real race: an in-flight pull writes the account's rows back after the wipe. `runFullSync` awaits `pullDelta` and then calls `applyMerged` with no check that sync was suspended or the user is still signed in (`src/components/sync/SupabaseFinanceSync.ts:576-598`, `:649-674`); the cold-start pull has the same gap (`:246`, the `cancelled` flag is only read at `:195`). The persist layer then saves it to `buddget-storage`. `clearBudgetData` itself is correct (cancels the queued write before and after the reset, `src/lib/auth/clearBudgetData.ts:42,76`). A different account signing in later is still protected (`ownedByAnother`, `SupabaseFinanceSync.ts:549-554`), so the exposure is data readable on the device, not a cross-account merge.
- **Fix plan:**
  1. `SupabaseFinanceSync.ts` `runFullSync` and `runLegacyFullSync`: after each awaited server call, return without touching the store when `syncSuspended` is set or the store no longer belongs to `userId` and is not the pre-pull state (pass a "still current" check in from the caller: suspended flag plus the mount's `cancelled`). No SQL migration.
  2. `AuthProvider.tsx` `signOut`: race `finalFlush` against a short timeout (reuse the `Promise.race` pattern of `unbindBiometricOnSignOut`, `src/lib/native/biometricAuth.ts:292-295`), so the wipe is never held by a stalled request. Unsent edits are then lost on a dead connection, which is already the case when offline.
  3. Test: `src/components/sync/financeSync.test.ts`, "a pull that answers after suspendFinanceSync does not write to the store" (fails today). E2E N3 should poll for the key to clear rather than read it once.
- **Effort / risk:** S-M · a guard that is too wide would drop a legitimate pull result after a same-user remount; the timeout value trades lost last-second edits against a prompt wipe.
- **Owner question:** Is a short wait acceptable between the login screen appearing and the local wipe (today: until the last edits are sent), or must the wipe happen first even if the last unsent edit is lost? Options: keep flush-then-wipe with a timeout (recommended, about 3 s) / wipe immediately.
- **Related:** QA-19, QA-20 (same unguarded window after the awaited pull); SYNC-006 named in the ticket.


## 6.7 Functional, P3

### QA-86 · QA-003 · Wealth shows "Saves 100% of income" with zero income
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence high
- **Evidence:** The literal zero-income case is already guarded: `savingsRatePct` returns null when income is 0 (`src/lib/savings/wealthModel.ts:133`, tested in `wealthModel.test.ts:41`) and `SavingsHero.tsx:92` hides the line. What the tester saw is a different thing: `wealth/page.tsx:239` passes `stats.savingsThisMonth` and `stats.totalIncome`. In the current month `savingsThisMonth` is a projection, `max(0, projectedIncome - totalExpenseBudget)` (`src/lib/utils/monthlyStats.ts:233-235`), and `totalIncome` fills unpaid paydays with the expected amount (`monthlyStats.ts:142-143`). With an income source that has not paid yet and no expense budget, that is expected / expected = 100%. So the line shows a plan figure worded as a fact ("Saves"), and it is 100% whenever there is no budget.
- **Fix plan:**
  1. `src/app/(app)/wealth/page.tsx:239`: pass null (hide the line) when `stats.receivedIncome <= 0` or `stats.totalExpenseBudget <= 0` (both already on the stats object). No change to `savingsRatePct`.
  2. Test: extend `src/lib/savings/wealthModel.test.ts` only if the gate is moved into a small helper (e.g. `savingsRatePct(saved, income, { received, budget })`); otherwise a render test for the Wealth page with expected-but-unreceived income and no plan asserting the "Saves" line is absent. Fails today (shows 100%).
  3. No migration.
- **Effort / risk:** S · the line disappears for users with no budget or before the first payday of the month; nothing else reads it.
- **Owner question:** Should "Saves X% of income" mean the plan (expected income minus budget, today's behaviour) or what really happened (received income minus spend)? If the plan, reword to "Plans to save X%"; if actual, switch the inputs to `receivedIncome` and realized savings.
- **Related:** none.

### QA-87 · QA-004 · Instalments past their due date show no overdue marker
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** The instalment card prints the next unpaid slice under a fixed "Next cycle" label with no date comparison: `src/hooks/useDebtTabData.ts:301` (`next: nextInstallmentDueFormatted(d, paid, locale)`) and `src/components/features/debts/redesign/DebtCard.tsx:242-248`. `nextInstallmentDueDate` (`src/lib/debts/installmentSchedule.ts:41-47`) returns start date + completed periods, so with 0 paid it stays on the past date. The Debts hero "Next" cell shows only an amount (`DebtPortfolioHero.tsx:74`). No overdue state exists for debts in `src/components/features/debts` or `src/lib/debts` (the only past-due text is a hint inside the recurring-payment form, `RecurringDebtPaymentForm.tsx:143`). Overdue reminders exist only for recurring debt payment templates (`src/lib/notifications/evaluateAlerts.ts:44-70`), not for plain instalment debts.
- **Fix plan:**
  1. `src/hooks/useDebtTabData.ts`: add `overdueDays?: number` to `InstallmentVM`, computed from `nextInstallmentDueDate(d, paid)` vs today with `differenceInCalendarDays` (0 or less = not overdue).
  2. `DebtCard.tsx` `InstallmentBody`: when `vm.overdueDays > 0`, swap the "Next cycle" caption for an "Overdue" caption in `var(--color-brand-red)` (keep the date). Additive, default look unchanged.
  3. Copy: add `debts.overdue` to `src/lib/i18n/types.ts`, `dictionaries/en.ts`, `dictionaries/ar.ts`.
  4. Test: new case in `src/lib/debts/installmentSchedule.test.ts` or a `useDebtTabData` test: instalment debt with `startDate` two days ago and 0 payments yields `overdueDays === 2`; fails today (field does not exist).
  5. No migration.
- **Effort / risk:** S · only the instalment card caption; risk is timezone off-by-one, use the local-day helpers already used in this hook.
- **Owner question:** none.
- **Related:** none.

### QA-88 · QA-006 · Net worth counts a foreign-currency account at face value when no FX rate exists
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `src/lib/accounts/netWorthBasis.ts:13` still does `ledger.convert(b.balance, b.currency, base) ?? b.balance`. The same fallback is in the Accounts hero totals: `src/lib/accounts/useAccounts.ts:71-72`. `computeNetWorth` does the opposite for pockets and holdings: skip and set `netWorthIncomplete` (`src/lib/savings/netWorth.ts:56-75`). The accounts engine already knows the value is unreliable (`AccountBalance.approx`, `balance.ts:71-76`, and `useAccounts.ts:70` sets `approx`), but `accountsBasisFor` drops that flag, so net worth shows no "At least" prefix. Latent: it needs an account currency with no path in the rates map (or an empty rates map on a cold offline start). `netWorthBasis.test.ts` has no missing-rate case.
- **Fix plan:**
  1. `netWorthBasis.ts`: when `convert` returns null, leave the balance out and return `accountsIncomplete: true` alongside `accountsBasis`.
  2. `src/lib/savings/netWorth.ts`: add optional `accountsIncomplete?: boolean` to `NetWorthInput` and OR it into `valuationIncomplete`. `useNetWorth.ts` and `src/lib/buddgy/tools/exec/savings.ts:107` already spread the basis object, so no call-site change.
  3. `useAccounts.ts:71-72`: same rule (skip, keep `approx = true`) so both heroes agree.
  4. Test: `src/lib/accounts/__tests__/netWorthBasis.test.ts`, an account in a currency whose `convert` returns null: expect it excluded from `accountsBasis` and `accountsIncomplete === true`. Fails today (counted 1:1).
  5. No migration.
- **Effort / risk:** S · with a truly missing rate the net worth drops by the excluded account and shows "At least"; that is the intended behaviour but is a visible change.
- **Owner question:** none.
- **Related:** QA-121 (same Accounts hero file), QA-122.

### QA-89 · QA-008 · Add-expense sheet opens with Rent preselected
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `src/hooks/useAddExpenseSheet.ts:62` seeds `category` with `defaultCategory`, and `src/hooks/usePlanCategories.ts:49` defines that as the first chip (`categoryChipOptions[0]`): the first category of the active plan, else the first of `EXPENSE_ENTRY_CATEGORIES`. Rent is first in both and first in the grid (`src/lib/constants/categoryGrid.ts:55`). `resetForm` re-applies it (`useAddExpenseSheet.ts:134`). `handleSubmit` (`:160-165`) validates only title and amount, so a fast save files as Rent. No comment or test states this default is intended (the only test mocks it to 'Food').
- **Fix plan:**
  1. `useAddExpenseSheet.ts`: start and reset `category` as `''` (prefill from `expensePrefill.category` keeps working, `:105`).
  2. Treat an empty category as invalid in `handleSubmit` (same hook) and add `|| (mode === 'add' && !category)` to `submitDisabled` in `src/components/features/expenses/ExpenseSheetForm.tsx:156` so the Save button stays disabled until a tile is picked. The grid (`ExpenseSheetForm.tsx:280-296`) already renders "none selected" correctly because selection is `c.id === category`.
  3. Leave `usePlanCategories.defaultCategory` alone (other callers may use it); just stop using it here.
  4. Test: `src/hooks/__tests__/formsSubmit.test.ts`, submit with title and amount but no category: expect `addExpense` not called; then pick a category and expect it called with that category. Fails today (saved with the default).
  5. No migration.
- **Effort / risk:** S · one extra tap on every manual expense; check the edit form and the voice/Buddgy/SMS prefill paths still arrive with a category.
- **Owner question:** No preselection (one extra tap, never misfiled) or preselect the user's most used category of the last 30 days (zero taps, occasionally wrong)? The plan above is the first option.
- **Related:** none.

### QA-90 · QA-009 · Flow feed lists an own-account cash-out as a -50 row
- **Verdict:** NOT-A-BUG · ticket P3 → my severity P3 (polish only) · confidence med
- **Evidence:** Deliberate. Cash out is stored as one expense row in a non-spend category with a target account: "One non-spend row, two balance deltas" (`src/lib/accounts/actions.ts:26-39`; `docs/ACCOUNTS_REFACTOR_MASTER_PLAN.md:185`; `docs/MONEY_MOVEMENT.md:73`). Flow lists every expense row and marks non-spend ones as not counted: `counted: !dim && !nonSpend`, muted amount colour and a circle-slash "Not counted" badge (`src/components/features/flow/useFlowLedger.tsx:201-212, 243-244, 255`); the day net and band totals use `counted` only (`:486`). `docs/EXCLUSIONS_AND_MULTI_DEVICE_PLAN.md:9` records "the Flow list shows a badge" as the shipped design. The row is also the only place the user can edit or delete the cash-out.
- **Effort / risk:** n/a.
- **Owner question:** Optional polish, decide with QA-93: the badge is an icon only. Should a transfer row show the destination ("QNB → Cash") and drop the minus sign so it does not read as spending?
- **Related:** QA-93 (same decision).

### QA-91 · QA-011 · Mixed rounding on one screen
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** It is a code convention, not an accident: the hero's big number uses two decimals and every cell/scale line uses whole numbers. Subscriptions: due `formatFixed2(hero.due30)` (`src/components/features/subscriptions/SubscriptionsHero.tsx:40`) next to `formatWhole` for paid/left (`:51-52`), monthly equivalent and per year (`:26-27`), so 19.99 sits beside 20 and 239.88 shows as 240. Flow: big `formatFixed2(spent)` (`src/components/features/flow/useFlowBand.ts:221, 253`) with Money out `formatSigned(-spent)` at 0 digits (`:99`) and Spent `formatWhole` (`:147, 171`). No rounding policy is written in `docs/DESIGN_SYSTEM.md` (only the Accounts screens have one, line 408). The maths is right; only the display precision differs.
- **Fix plan:**
  1. Policy (one line in `docs/DESIGN_SYSTEM.md`): figures that restate the hero amount on the same band use the hero's precision; use the existing `formatFlex` (whole when whole, else two decimals, `src/lib/utils/formatters.ts:191`).
  2. `SubscriptionsHero.tsx:26-27, 51-52`: `formatWhole` → `formatFlex` for paid, left, monthly equivalent, per year.
  3. `useFlowBand.ts:98-99` and the sticky `right` arrays (`:230, 264`): `formatSigned(x)` → `formatSigned(x, 2)` when the value is not whole (or add a `formatSignedFlex` beside `formatFlex`); Spent cells (`:147, 171, 201, 206`) → `formatFlex`.
  4. Test: `src/components/features/flow/budgetHero.test.ts` or a new `useFlowBand` case: spent 619.99 yields big "619.99" and Money out "−619.99"; a subscriptions hero case: 19.99 monthly yields per year "239.88". Both fail today.
  5. No migration.
- **Effort / risk:** S · cells are narrow; long values with cents may truncate on small phones, check 320px.
- **Owner question:** One rounding rule for hero bands: (a) cells follow the hero and show cents when not whole (plan above), (b) everything whole including the big number, or (c) keep today's "big exact, cells whole" and close as designed?
- **Related:** QA-121 (same policy; that one is a real truncation bug).

### QA-92 · QA-012 · "Still using it?" nudge seconds after adding a subscription
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `pickNudge` always adds a `still` candidate for the most expensive active monthly subscription, with no age check: `src/lib/subscriptions/subscriptionNudges.ts:56-61`. Its key is per calendar month (`subnudge:still:<id>:<yyyy-MM>`), so a subscription added today qualifies at once. The existing test only covers the fallback itself (`subscriptionRows.test.ts:115-116`).
- **Fix plan:**
  1. `subscriptionNudges.ts`: add to the `monthly` filter `differenceInCalendarDays(now, parseISO(r.sub.createdAt)) >= 30`. Use `createdAt` (when it was added to the app), not `startDate` (the user can backdate that to when they first subscribed).
  2. Test in `src/lib/subscriptions/subscriptionRows.test.ts`: a monthly sub with `createdAt` = today returns no `still` nudge; one created 31 days ago still does (give the existing fixture an old `createdAt`). First case fails today.
  3. No migration.
- **Effort / risk:** S · none beyond the nudge appearing later.
- **Owner question:** none (30 days = one billing cycle; change the number if a different wait is wanted).
- **Related:** none.

### QA-93 · QA-017 · Internal moves render inconsistently in Flow (ATM listed, goal funding not)
- **Verdict:** UNSURE · ticket P3 → my severity P3 · confidence high on the facts
- **Evidence:** The difference comes from where each move is stored, not from a rendering bug. Cash out is an expense row in a non-spend category (`src/lib/accounts/actions.ts:27-39`), and Flow is built from expenses, income and pending SMS only (`src/components/features/flow/useFlowLedger.tsx:72-76, 192-196, 281-316, 410-455`). Set aside / goal funding is a savings transaction (`actions.ts:42-44` → `depositToSavings`, `src/lib/store/useFinanceStore.ts:1754-1806`), and Flow never reads `savingsTransactions`. Own transfers, top-ups, FX, card payoffs and instalments are also expense rows, so they show; every pocket or goal deposit and withdrawal does not. No comment, doc or test says savings moves are meant to be left out of Flow, so the code gives no intent either way.
- **Fix plan:** (after the owner decides; option B shown)
  1. `useFlowLedger.tsx`: read `savingsTransactions` and `savingsAccounts`; for cash-flow deposits/withdrawals with a `paymentMethodId` in range, push a `FlowItem` with `counted: false`, the same muted amount and "Not counted" badge as non-spend expenses, title = pocket name, subtitle = source account, tap opens the pocket.
  2. Skip `source: 'transfer'` (pocket to pocket), opening balances and `goal_opening` rows.
  3. Test: `src/components/features/flow/FlowLedger.test.ts`, one ATM expense and one pocket deposit on the same day: both listed, neither in the day net. Fails today (deposit missing).
  4. No migration.
- **Effort / risk:** M · filters (segment, category, method, amount) and delete/undo need to behave for the new row kind; risk of double rows if a legacy `Savings`-category expense also exists for the same deposit.
- **Owner question:** What is Flow's rule for money that only moves between the user's own places? (A) Keep as is: account-to-account moves show with the "Not counted" badge, pocket and goal moves live on Wealth/Goals only. (B) Show all internal moves, muted and badged (plan above). (C) Hide all non-spend rows from Flow by default behind a "Not counted" filter chip (the chip is already noted as missing in `docs/EXCLUSIONS_AND_MULTI_DEVICE_PLAN.md:9`).
- **Related:** QA-90 (same decision).

### QA-94 · QA-020 · Debt-free date disagrees across screens (Budget Aug 2027, Debts Oct 2027)
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** Two separate engines. Budget: `debtFreeMonth` (`src/lib/budget/debtPayoff.ts:15-53`, called from `src/lib/budget/planView.ts:187`) simulates a snowball from the current month: every minimum is paid this month, the plan's extra goes to the smallest balance, and a cleared debt's payment rolls onto the next. Debts: `debtFreeBy(projectedEnds)` (`src/lib/debts/heroStats.ts:40-48`, fed by `src/hooks/useDebtTabData.ts:367-403`) takes the latest contractual end date per debt (recurring plan end, instalment schedule end, or payoff-goal target), with no extra and no rollover. Two instalment plans therefore finish earlier in Budget (rollover/extra) than on Debts (fixed schedule). Each function is documented and tested for its own rule; nothing ties them together or tells the user they answer different questions.
- **Fix plan:** (recommended: Debts page is the contractual truth, Budget says it is a plan)
  1. Copy only, no maths change: Budget strings `overviewCopy.ts:82` ("Debt-free {m}"), `blocksCopy.ts:122, 191`, `segmentCopy.ts:80, 114` → "Debt-free {m} on this plan"; Debts `dictionaries/en.ts:1308` "Debt-free by" → "Last payment" (and the `ar` twins).
  2. If one number is wanted instead: in `planView.ts:187`, when the plan's extra is 0, do not roll freed minimums for instalment/BNPL debts (fixed schedules cannot be accelerated by rollover) by passing a `fixed: true` flag on those `PayoffDebt`s; add the case to `src/lib/budget/debtPayoff.test.ts` (a 6-month and a 12-month fixed plan, extra 0 → the long one still ends at month 11; today the short plan's payment rolls over and ends it earlier).
  3. No migration.
- **Effort / risk:** S for copy, M for the engine change · the engine change moves the Budget date later for users with instalment debts; review states in `src/lib/budget/reviewState.ts:50` read the same field.
- **Owner question:** Which date is the app's "debt-free" date: the contractual schedule (Debts page) or the plan's snowball projection (Budget)? Keep both with distinct labels (step 1), or make Budget match the schedule when no extra is planned (step 2)?
- **Related:** none.

### QA-95 · QA-022 · Reports net-worth caption describes a different formula; "Biggest purchase" is a debt payment
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** Caption: `reports.netWorthHint` is a fixed string, "Account balances + this month's cash flow − active debt" (`src/lib/i18n/dictionaries/en.ts:1653`, `ar.ts:1662`, shown by `src/components/reports/ReportsNetWorthPanel.tsx:45`). The formula is `savings + investments + (accountsBasis ?? monthlyFlow) − debt` (`src/lib/savings/netWorth.ts:77-78`): once any account is tracked the cash-flow term is replaced by tracked account balances, so the caption is wrong for those users and right only for users with no tracked account. Biggest purchase: `largestExpense` is the max over `reportSpendRows(inPeriod)` (`src/hooks/useReportsPage.ts:71, 128-136`), which only removes money movements, excluded and refunded rows; debt payments are category `Debt`, a spend category, with descriptions like "<debt> — debt payment" (`src/lib/debts/recurringDebtDueHandlers.ts:127`), so one can win. Side note: this panel prints net worth with cents (`ReportsNetWorthPanel.tsx:29`), a third rendering of the number in QA-121.
- **Fix plan:**
  1. Caption: add `reports.netWorthHintAccounts` ("Tracked accounts + savings and investments − active debt") to `types.ts`, `en.ts`, `ar.ts`; in `ReportsNetWorthPanel.tsx` show it when `nw.accountsTotal != null` (field already on `NetWorthResult`), else the current string.
  2. Biggest purchase: in `useReportsPage.ts:128` take the max over `filteredExpenses.filter((e) => !isDebtLinkedExpense(e))` (helper already imported and used at `:65-66`).
  3. Test: a `useReportsPage`/reports unit test with one 500 debt-linked expense and one 300 grocery expense expects the 300 row as biggest purchase (fails today); a `ReportsNetWorthPanel` render test with `accountsTotal` set expects the accounts caption.
  4. No migration.
- **Effort / risk:** S · the same `largestExpense` feeds the "Copy summary" text (`useReportsPage.ts:150`), which changes with it; intended.
- **Owner question:** none.
- **Related:** QA-121 (net worth shown three ways), QA-91.

### QA-96 · QA-025 · Buddgy reply amounts may be missing from the accessible name
- **Verdict:** NOT-A-BUG · ticket P3 → my severity P3 · confidence med (code only, no screen reader run)
- **Evidence:** Reply amounts are ordinary text inside `<strong>` within a `<p>` or `<li>`: `src/components/features/ai-chat/BuddgyMarkdown.tsx:4-16, 26-33`. Nothing sets `aria-label`, `aria-hidden`, `role="presentation"` or CSS-generated content on the bubble or the spans, and the transcript is a `role="log"` live region (`AIChatMessageList.tsx:48`). A paragraph has no accessible name from its content by spec, so the tool's "computed name" that skipped child elements is an artefact of the tool; screen readers read the text nodes, including those inside `<strong>`. The audit itself marked this SUSPECTED and unverified.
- **Effort / risk:** n/a. A two-minute VoiceOver/TalkBack pass on one reply would close it for good.
- **Related:** none.

### QA-97 · QA-026 · /buddgy is a 404; Buddgy has no deep link
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 (missing feature, nothing is broken today) · confidence high
- **Evidence:** There is no `src/app/(app)/buddgy` route; unknown paths fall to `src/app/(app)/[...slug]/page.tsx`, which calls `notFound()`. Buddgy opens only through store state: `setActiveModal('aiChat')` / `openAiChatWithSeed` (`src/lib/store/useSettingsStore.ts:319`, `src/components/modals/ModalProvider.tsx:96-103`, `src/components/features/usage/NoticeHost.tsx:71`). No URL or query parameter maps to it. Nothing in the repo links to `/buddgy` today, so no existing link is broken.
- **Fix plan:**
  1. Add `src/app/(app)/buddgy/page.tsx`: a client page that on mount runs the same guard as the bubble (`requireAuth(() => setActiveModal('aiChat'), t.modals.fabRequireAuthAi)`) and then `navigate('/')` via `src/lib/navigation/navigate`, so the chat opens over the home screen. Same pattern as the kept `/expenses` and `/income` routes ("the route stays so existing links and push taps land there").
  2. Do not accept a prompt in the query string (user text must not travel in URLs).
  3. Test: render the page with a signed-in store and expect `activeModal === 'aiChat'`; today the path renders not-found.
  4. No migration. Works in the native static export because it is a normal route.
- **Effort / risk:** S · check the in-memory view shell treats `/buddgy` as a pass-through and not a tab.
- **Owner question:** Is a Buddgy link wanted now (emails, push, help articles), or should this be closed as "not planned" until something needs it?
- **Related:** none.

### QA-121 · QA-014 · Net worth -15,220 on Wealth and -15,219 on Accounts
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** Same value (`nw.netWorth`), two formatters. Wealth rounds: `formatWhole(nw.netWorth)` (`src/app/(app)/wealth/page.tsx:237`). Accounts truncates: `AccountsHero.tsx:27` uses `splitMoney(n, currency).int`, the integer part of a two-decimal string with the decimals thrown away (`src/components/features/accounts/accountDisplay.ts:44-49`), so −15,219.99 prints "−15,219". The same truncation applies to the three hero cells (In accounts, Set aside, Credit owed, `AccountsHero.tsx:76-78`); only the big number shows the dimmed decimals. The ticket has no comments.
- **Fix plan:**
  1. `AccountsHero.tsx:27`: `fmt = (n) => hidden ? MASK : splitMoney(Math.round(n), currency).int` (keeps the true minus sign the Accounts screens use; no new helper).
  2. Test in `src/components/features/accounts/accountDisplay.test.ts` or `accounts.render.test.ts`: hero with net worth −15,219.99 renders "−15,220"; fails today ("−15,219").
  3. No migration.
- **Effort / risk:** S · the three cells also move from truncation to rounding (at most 1 unit).
- **Owner question:** none.
- **Related:** QA-91 (rounding policy), QA-88.

### QA-122 · QA-015 · Accounts shows "Set aside 0" after creating a 100 EGP pocket inside QNB
- **Verdict:** CONFIRMED · ticket P3 → my severity P2 (same root as the net-worth double count) · confidence high
- **Evidence:** Wealth > Add pocket > from an account creates the pocket with `linkedPaymentMethodId` only (`src/components/features/savings-v3/PocketFormSheet.tsx:71-83`). "Set aside" on Accounts is the sum of pockets whose `heldInPaymentMethodId` is that account (`src/lib/accounts/balance.ts:130-134`, `useAccounts.ts:72`). No client code ever writes `heldInPaymentMethodId`: the only writers are the two server jobs (`src/lib/server/allocateGoalFunding.ts:97`, `src/app/api/cron/month-carry/route.ts:142`). The plan says "Pockets default to held-in an account" and keeps the two columns distinct (`docs/ACCOUNTS_REFACTOR_MASTER_PLAN.md:16, 74, 154`). Because the pocket is not held-in, net worth also adds its 100 on top of the unchanged QNB balance (`netWorthBasis.ts:14`, `netWorth.ts:60`), and the opening deposit has no account leg (`useFinanceStore.ts:1673-1689`).
- **Fix plan:**
  1. `PocketFormSheet.tsx` `create`: when `linkedMethod` resolves to a tracked account (`resolveAccountId` in `src/lib/accounts/resolve.ts`, `isTracked` in `src/lib/accounts/kinds.ts`) in the pocket's currency, also set `heldInPaymentMethodId` to that account id. The opening balance then becomes an earmark: account balance unchanged, "free" shrinks, "Set aside" shows 100, net worth skips the pocket.
  2. Validate the amount against the account's `free` (same rule as `MoveMoneySheet.tsx:49`), reusing its "more than free" copy.
  3. Test: `src/lib/accounts/balance.test.ts`, pocket with `heldInPaymentMethodId` = account and balance 100 → `held === 100`; plus a PocketFormSheet test that creating from a tracked account passes `heldInPaymentMethodId` to `addSavingsAccount`. The second fails today.
  4. No migration (column `held_in_payment_method_id` exists since 0151, mapped in `savingsAccountMapper.ts:47, 69`). Existing pockets created this way stay as they are unless the owner wants a one-off backfill.
- **Effort / risk:** S-M · zakat and net worth both read the held set (`zakatAccounts.ts:15`), so totals drop by the previously double-counted amount for new pockets; untracked accounts keep today's behaviour.
- **Owner question:** When a pocket is created "from an account", is the amount an earmark inside that account (plan above, matches the accounts plan) or new money outside it (today's behaviour, which adds to net worth)? And should existing linked pockets on tracked accounts be backfilled to held-in?
- **Related:** audit QA-013 (same root), QA-88.

### QA-123 · QA-016 · New bank account (pocket) sheet shows a horizontal scrollbar at 490 px
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence med (read from code, not run)
- **Evidence:** The row directly under amount/currency is the colour picker. `ColorSwatchRow` is a horizontal scroller (`overflow-x-auto`, 25 swatches ≈ 1,090px) with no scrollbar-hiding class (`src/components/ui/ColorSwatchRow.tsx:28`; palette at `src/lib/payment/paymentMethodDefaults.ts:441-445`), so any browser with classic scrollbars draws one at every width, not only 490px. Phones use overlay scrollbars and do not show it. Second finding: the class `no-scrollbar` used in six files (`PocketFormSheet.tsx:119`, `AssetFormSheet.tsx:100, 132`, `MoveMoneySheet.tsx`, `WithdrawSheetV3.tsx`, `WealthList.tsx`, `ZakatSheet.tsx`) is not defined anywhere; the real utility is `.hide-scrollbar` (`src/app/globals.css:520-526`), so those chip rows show a scrollbar on desktop too.
- **Fix plan:**
  1. `ColorSwatchRow.tsx:28`: add `hide-scrollbar` (bug fix on a shared component, default look unchanged on phones; note to the owner per the design-system rule).
  2. Replace `no-scrollbar` with `hide-scrollbar` in the six files above.
  3. Test: `src/components/ui/a11yFixes.test.tsx` already renders `ColorSwatchRow`; assert the radiogroup has `hide-scrollbar`. Fails today.
  4. No migration.
- **Effort / risk:** S · on desktop with a mouse and no trackpad the hidden row can only be scrolled with shift+wheel or the keyboard; if that matters, wrap the swatches on wide screens instead.
- **Owner question:** none.
- **Related:** none.

### QA-124 · QA-031 · CLAUDE.md names the wrong Supabase project on auth-hardening
- **Verdict:** FIXED · ticket P3 → my severity P3 · confidence high
- **Evidence:** At HEAD `fe5b2097`, `CLAUDE.md:7` names `tzioppxwsljhlglyducm` (Frankfurt) and marks `ydihurtbcnoflhormgzi` as retired; `CLAUDE_CONTEXT.md:29` agrees. The fixing commit `acdbb062` is an ancestor of `main` and of this branch. The stale copy exists only on `origin/auth-hardening`, which this validation does not cover; close the ticket when that branch is rebased or deleted.
- **Effort / risk:** n/a.
- **Related:** none.


## 6.8 UI, Arabic, accessibility

### QA-27 · QA-027/028/029, UI-004 · Arabic number/unit reordering, truncation, clipping
- **Verdict:** PARTIAL · ticket P2 → my severity P2 · confidence high (code), med (exact visuals; no device run)
- **Evidence:**
  - Reordering (QA-027) is real, and the cause is narrower than "no bidi isolation": `src/app/globals.css:614-617` forces `direction: ltr; unicode-bidi: isolate` on every `.font-mono-numbers` in Arabic. That is right for a bare number and wrong for a dictionary string that mixes a number with an Arabic word. `FlowSummaryBand.tsx:87` renders `t.flow.perDay()` (`ar.ts:3057` = `${x}/يوم`) and `DebtPortfolioHero.tsx:91` renders `heroClearedPct` (`ar.ts:1321` = `سُدد ${pct}%`) inside that class, so the unit/percent sign lands on the wrong side of the number. Same for the `BandScale` lines (`HeroBand.tsx:91-93`, e.g. `heroBorrowedTotal` `ar.ts:1308`).
  - The class rule also beats the `dir` attribute (author CSS wins over the attribute's UA mapping), so the five places that already wrote `dir="auto"` + `font-mono-numbers` get no benefit in Arabic: `BudgetHero.tsx:89`, `LedgerRow.tsx:142-143`, `FoundSubscriptionsSheet.tsx:89`, `HeldMessagesSheet.tsx:209` (an Arabic SMS body is laid out LTR there).
  - Truncation (QA-028) is real: `DebtPortfolioHero.tsx:60-62` builds `"500 / 1.8 ألف"` (`formatCompact` uses `ar-EG` compact words, `formatters.ts:33`) into a 16px `truncate` cell and does not pass `fitCells`; Flow's band does (`FlowSummaryBand.tsx:75`).
  - Clipped chip row and LTR month arrows (QA-029) are by design, not a defect: Arabic keeps the English layout (`src/lib/i18n/index.tsx:42-43` sets `dir="ltr"` always; `docs/DESIGN_SYSTEM.md` "UI layout stays LTR throughout"). `FlowChipRow.tsx:72` is a left-starting horizontal scroller in both languages; the cut-off chip at the right is the scroll cue. The `rtl:rotate-180` on the chevrons (`FlowMonthRow.tsx:96,114`) never matches in production (see QA-44).
- **Fix plan:**
  1. `src/app/globals.css:614`: change the selector to `html[data-locale='ar'] .font-mono-numbers:not([dir])`. An explicit `dir` on the element then wins; bare numbers are unchanged. No component is reshaped. This alone repairs the five existing `dir="auto"` sites listed above.
  2. Add `dir="auto"` to the mono elements that render a dictionary sentence rather than a bare number: `FlowSummaryBand.tsx:87` (`side`) and the three `BandScale` spans at `:113-115`; `DebtPortfolioHero.tsx:91` and the two `BandScale` spans at `:105-106`; the `savesPct` span at `SavingsHero.tsx:92`. English output is identical (`dir="auto"` resolves to LTR for Latin text). Then sweep: every `ar.ts` function that interpolates a number next to an Arabic word, check its render site for `font-mono-numbers`, add `dir="auto"` there.
  3. `DebtPortfolioHero.tsx`: pass the existing `fitCells` prop to `HeroBand` (additive prop, default look unchanged for short figures) and build the month cell without the spaces around the slash to save two characters.
  4. No SQL migration.
  5. Tests: (a) a guard next to `src/app/globalsContrast.test.ts` that reads `globals.css` and fails unless the Arabic mono rule carries `:not([dir])`; (b) render tests for `FlowSummaryBand` and `DebtPortfolioHero` asserting `dir="auto"` on the side figure and that the debts band passes `fitCells` (cell with a 13-character value gets `text-[14px]`). Both fail before, pass after. Then one Arabic pass on a 375px device.
- **Effort / risk:** M · Step 1 changes the Arabic rendering of the five existing `dir="auto"` mono elements; `LedgerRow` amounts with an Arabic currency sign will flip to number-right. Check Budget ledger rows in Arabic before shipping.
- **Owner question:** Is the English-order layout in Arabic (month arrows, chip rows starting on the left) still the intended design? Options: (a) keep it, close the QA-029 part as by design; (b) plan a real RTL mirror as a separate project. I planned for (a).
- **Related:** QA-44 (same "rtl: variant" misunderstanding), QA-112 (Arabic truncation), QA-114.

### QA-44 · UI-001 · Arabic ON switch thumb outside its track
- **Verdict:** NOT-A-BUG (in production builds) · ticket P2 → my severity P3 hardening only · confidence med-high
- **Evidence:**
  - The thumb only moves left if the `rtl:` classes in `src/components/ui/switch.tsx:31` match. Tailwind 4.2.2 compiles `rtl:` to `:where(:dir(rtl),[dir=rtl],[dir=rtl] *)`, and the app sets `<html dir="ltr">` in every locale (`src/app/(app)/layout.tsx:133`, `src/lib/i18n/index.tsx:43`), so nothing matches.
  - Checked three ways: the live CSS served by buddget.app today (`/_next/static/css/d8a80efa8318b237.css`) has the switch rule under `:dir(rtl)`, 18 `rtl:` rules, none lowered to `:lang()`; the local static export (`out/_next/static/css`) is the same; and the switch markup rendered in headless Chrome with that CSS under `<html lang="ar" dir="ltr">` puts the thumb at x 338-358 inside a 315-359 track (`:dir(rtl)` false, translate +20px).
  - Why the audit saw it: Lightning CSS, with Next's default browser targets, rewrites `:dir(rtl)` to `:lang(ar, he, fa, …)` (reproduced with the repo's `lightningcss`). A Turbopack run (`next dev` / `next build` without `--webpack`) does that rewrite, and then every `rtl:` class fires on `lang="ar"` while the layout is still LTR, which is exactly the measured 296-316. `package.json` and `scripts/capacitor-build.mjs:128` both pin `--webpack`, where Tailwind's own optimiser leaves `:dir()` alone.
  - Not checked: a signed-in Arabic settings page on a real device (needs an account). A 10-second look settles it.
- **Effort / risk:** n/a for the ticket. Latent risk: the day the `--webpack` flag is dropped, all 18 `rtl:` rules (switch thumb, flipped chevrons in `SettingsRow.tsx:56`, `FlowMonthRow.tsx:96,114`, `founders/page.tsx:131` row reversal) turn on in Arabic. Optional S hardening, in the same change as QA-27: delete the three `rtl:…-translate-x` classes from `switch.tsx` (bug fix, default look unchanged) and add a note beside the `--webpack` flag.
- **Related:** QA-27.

### QA-45 · UI-002 · Same document title on every route
- **Verdict:** PARTIAL · ticket P2 → my severity P2 · confidence high
- **Evidence:**
  - A per-route title mechanism already shipped in `5c3cdb8e` (2026-11-06): `src/components/layout/RouteAnnouncer.tsx:21-24` sets `document.title` to `"<h1> · buddget"` 80ms after each view change, reading `main.querySelector('h1')`.
  - It misses on the main tabs because their heading is not inside `<main>`: the section title `h1` lives in the shell header (`DesktopHeaderBar.tsx:25,49`), a sibling of `<main>` (`AppShell.tsx:331-332`). Only views with their own in-main `h1` (Notifications, budget segment pages, onboarding steps) get a real title. Flow, Accounts, Wealth, Debts, Settings, Reports, Goals and Subscriptions resolve to plain `buddget` (`routeAnnounce.ts:7`), or keep the layout default from `src/app/(app)/layout.tsx:41` until the timer fires.
  - Same miss hits the screen-reader announcement: `setMessage(heading ?? '')` (`RouteAnnouncer.tsx:26`) announces an empty string on those routes, so a view change is silent. That is the more serious half.
- **Fix plan:**
  1. `RouteAnnouncer.tsx`: fall back to the header's own source when `<main>` has no `h1`: `sectionTitleNavKey(path)` → `t.nav[key]` (`src/lib/navigation/bottomNavConfig.ts:32`, the exact lookup `DesktopHeaderBar.tsx:16-17` uses, already localized). Keep the in-main `h1` first so sub-pages with their own heading stay specific. Add the resolved section title to the effect deps so switching language updates the tab title.
  2. Put the choice in a pure helper in `routeAnnounce.ts` (`headingFor(mainH1, sectionTitle)`), next to `documentTitleFor`.
  3. No SQL migration.
  4. Test in `src/components/ui/a11yFixes.test.tsx` (already covers `documentTitleFor`): no in-main heading + section "Debts" gives `Debts · buddget` and a non-empty announcement; an in-main heading still wins. Fails before, passes after.
- **Effort / risk:** S · Settings sub-pages all read "Settings · buddget" unless they render an `h1`; acceptable for A-level, can be refined later. No visual change.
- **Related:** QA-115 (same header/main heading structure).

### QA-46 · UI-003 · Touch targets under 44px
- **Verdict:** PARTIAL · ticket P2 → my severity P2 · confidence high
- **Evidence:**
  - Emergency fund / Zakat pills: confirmed and worse than reported. `WealthHeroBadges.tsx:16` overrides the overlay position (`after:inset-x-0 after:-inset-y-2`) on a `Button size="sm"`, whose `HIT_AREA` (`src/lib/ui/hitArea.ts`) also sets `after:-translate-x-1/2 after:-translate-y-1/2`. `tailwind-merge` drops `left/top` but keeps both translates (verified by running `twMerge` on the two strings), so the 44px overlay sits half a pill to the left and 22px up. Result: the pill is tappable only on its own 28px, and when both pills show, the Zakat overlay lies over the right part of the Emergency pill, so a tap there opens Zakat.
  - Profile avatar: confirmed on every route, not only Wealth. `AuthNavButtons.tsx:59` adds `overflow-hidden` to an `IconButton size="sm"`, which clips the `after:` overlay to the 36px circle; the 44px wrapper span has no click handler.
  - Budget header button: not a bug by code. `BudgetHeaderButton.tsx:23-28` is an `IconButton` (36px glyph, 44px overlay, nothing clipping it). I cannot explain a route-dependent 36px reading from code.
  - Wordmark link: partly. `DesktopHeaderBar.tsx:43` is 24px tall with a centred 44x44 overlay, so only the middle 44px of its 101px width is 44 tall.
  - Next month: not a bug. `FlowMonthRow.tsx:107-115` is the same `IconButton size="sm"` as Previous month; at the current month it is `disabled` (`pointer-events: none`), so `elementFromPoint` falls back to the 32px box. Enabled, it has the same 44px area as Previous.
- **Fix plan:**
  1. `WealthHeroBadges.tsx:16`: add `after:translate-x-0 after:translate-y-0` to `PILL` so the overlay is the pill's width and 44px tall, centred. Visual pill unchanged.
  2. `AuthNavButtons.tsx:59`: remove `overflow-hidden` from the `IconButton`; crop the image instead with `rounded-full` on the `<img>` at `:69`. Same look, overlay restored.
  3. `DesktopHeaderBar.tsx:43`: add `py-2.5` to the wordmark link (24 + 20 = 44px box; no background, header is `h-14 items-center`, so nothing moves).
  4. No change to the month arrows or the Budget button. No SQL migration.
  5. Tests: render `WealthHeroBadges` with both pills and assert the merged class has no negative `after:` translate; render the avatar and assert the `IconButton` has no `overflow-hidden`; extend the guard in `src/components/ui/noStyledRawButtons.test.ts` (or a sibling) to fail on `overflow-hidden` in an `IconButton`/`OptionChip` className, since that silently removes the hit area. Fail before, pass after. Verify with a tap on device.
- **Effort / risk:** S · The pill overlays will now extend 8px above and below; they sit in a 22px row with the number row beneath, nothing interactive there. Avatar hover ring unaffected.
- **Related:** QA-109 (same hit-area mechanism), QA-117 (Wealth header).

### QA-108 · UI-005 · Duplicate "Monthly Savings" pockets within 20ms
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high (mechanism), med (which path produced the three rows)
- **Evidence:**
  - The seed is purely client-side: `src/hooks/useEnsureMonthlySavingsVault.ts:21-34` (only caller `src/app/(app)/wealth/page.tsx:62`) inserts a vault with a fresh random id (`useFinanceStore.ts:1663`) whenever the local store has no savings accounts and no `defaultCarryPocketId`. The `seeded` ref only protects one mounted page. It is not a double tap or an effect re-run: `AppViewRouter.tsx:62-66` mounts one view at a time, and the ref survives StrictMode.
  - Three inserts 20ms apart are three clients of one brand-new account (the audit's parallel browser contexts): each pulls an empty server, each passes the guard, each upserts its own id (`src/lib/supabase/remote/sync.ts:284`). Nothing in the DB stops it; migration `0097` adds the `vault` type and the profile column, no uniqueness.
  - Two single-client paths reach the same result for an existing user, which the ticket does not mention: (a) a failed first pull still sets `dataReady` true (`SupabaseFinanceSync.ts:249-260`), so a new device with an empty store seeds a second vault and overwrites `defaultCarryPocketId`, pointing the month-end carry at the new empty vault; (b) the warm-cache boot sets `dataReady` before the background reconcile (`SupabaseFinanceSync.ts:203-219`), so a stale cache opened straight on Wealth can seed before the server's vault arrives.
  - Extra vaults are deletable (`canDeletePocket.ts:6-17` only blocks the default one), so a user can clean up. Not checked: live duplicate counts (user-data scan not allowed).
- **Fix plan:**
  1. Make the vault id deterministic per user so every client writes the same primary key: a small pure helper (e.g. `systemVaultId(userId)` in `src/lib/savings/pocketIdentity.ts`, a fixed-namespace transform of the user uuid) and an optional `id` on `addSavingsAccount` (additive, same pattern as `addExpense` at `useFinanceStore.ts:280`). The hook passes it. N clients then upsert one row.
  2. Seed only after a confirmed server pull in this session: add a `markPulled/hasPulled(userId)` pair beside `markHydrated` in `src/hooks/remote/hydrateGuard.ts`, set it where `pulled = true` (`SupabaseFinanceSync.ts:247`) and after the warm reconcile succeeds, and require it in the hook. Closes paths (a) and (b).
  3. `src/app/api/cron/month-carry/route.ts:141-143`: use the same deterministic id for the `create-vault` insert (upsert, ignore duplicates) so the cron and a client converge on one row.
  4. SQL migration: none required. Optional backstop, owner's call: a partial unique index on `savings_accounts (user_id) WHERE type = 'vault' AND name = 'Monthly Savings' AND deleted_at IS NULL`. It needs a duplicate count first and conflict handling in the sync, so I would not bundle it.
  5. Test (new `src/hooks/useEnsureMonthlySavingsVault.test.ts`): two fresh stores for the same user id seed the same vault id; no seed while `hasPulled` is false; no seed when the store already has a default pocket. First two fail today.
  6. Cleanup: delete the two extra vaults on the synthetic QA user by hand.
- **Effort / risk:** M · A user who signs in offline-first gets the vault after the first successful sync instead of immediately. The deterministic id must be a valid uuid (the column is uuid).
- **Related:** none in this slice.

### QA-109 · UI-006 · Chips, pills and sheet controls below 44px
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence high
- **Evidence:** The audit measured the drawn box. Every chip here is an `OptionChip`, whose `sm` (36px) and `md` (40px) sizes carry an invisible 44px tap area (`src/components/ui/OptionChip.tsx:16-19`, `src/lib/ui/hitArea.ts`). That area is real only where a parent does not clip it, and a horizontal scroller (`overflow-x-auto`) clips vertically too. Per item:
  - Fine (44px): Flow category chips (`FlowChipRow.tsx:72`, scroller has `py-1`); income type chips (`IncomeTypeChipSlider.tsx:28`, `py-1 -my-1`); the expense sheet "Today" pill (`ExpenseSheetForm.tsx:194`, in the header, not a scroller).
  - Clipped, real: subscription category chips are 36px (`AddCatalogStep.tsx:50`, scroller has no vertical padding); payment-method type chips are about 40px (`PaymentMethodSetupSheet.tsx:320` `pb-0.5`, chips forced to `h-[38px]` at `:328`); Reports period chips about 42px (`ReportFilters.tsx:23` `pb-1` only); colour swatches about 42px (`ColorSwatchRow.tsx:28`, 34px + 4px padding each side).
  - No tap area at all, real: the Money-in "Today" pill is a raw 32px button (`IncomeSheetForm.tsx:223` forces `!h-8` on `DatePickerField`, whose button at `DatePickerField.tsx:49-55` has no overlay).
  - "Add note" (`ExpenseSheetForm.tsx:459-468`): `Button size="sm"` is 28px with a centred 44x44 area, so the middle of the label is fine and its ends are 28px. Minor.
- **Fix plan:**
  1. Give the three clipped scrollers the padding the overlay needs, with the negative margin trick already used in `IncomeTypeChipSlider.tsx:28` so nothing moves: `py-1 -my-1` on `AddCatalogStep.tsx:50`, `PaymentMethodSetupSheet.tsx:320` and `ReportFilters.tsx:23` (replacing `pb-0.5` / `pb-1`); `py-[5px] -my-px` on `ColorSwatchRow.tsx:28`.
  2. Money-in pill: use the same control as the expense sheet, `OptionChip as="trigger" size="sm"` opening `UnifiedDatePicker` (reuse, see QA-116), instead of the shrunken `DatePickerField`.
  3. "Add note": change `size="sm"` to `size="touch"` with the existing link variant, as the Money-in sheet already does for its note link (`IncomeSheetForm.tsx:363`).
  4. No SQL migration.
  5. Test: a source guard beside `src/components/ui/noStyledRawButtons.test.ts` that fails when a file renders `OptionChip` inside an `overflow-x-auto` row with no `py-` padding, plus a render test that the Money-in date trigger is an `OptionChip`. Fails before on the three files, passes after.
- **Effort / risk:** S · Negative margins must match the padding exactly or rows shift by a few px; compare screenshots of the four rows.
- **Related:** QA-46 (same hit-area mechanism), QA-116 (Money-in pill).

### QA-110 · UI-007 · Brand monogram tiles fail contrast
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:**
  - `src/lib/constants/brandTile.ts:46-51` picks white unless the fill's luminance is above 0.4. White and black are equally readable at luminance 0.18, so every fill between 0.18 and 0.4 gets white when black reads better. `BrandTile.tsx:55-57` applies it inline.
  - Computed over the catalogue: 32 monogram brands are under 4.5:1 today (YouTube 4.0, Prime Video 2.73, iCloud 3.16, Google One 3.56, du 2.41, Headspace 2.68, …); with the better of the two inks, none is.
  - The ticket's reference to `inkOn()` is about a different component (`accounts/BrandMark.tsx:22`); the subscription tile has its own helper, and it also returns the literal keywords `white`/`black` instead of the ink tokens.
  - Mitigating: the tile is `aria-hidden` and the brand name is printed beside it, so nobody depends on the two letters.
- **Fix plan:**
  1. `brandTile.ts`: replace the 0.4 cut with the existing contrast helper `inkFor(color)` from `src/lib/ui/contrast.ts:38` (picks whichever ink token has the higher ratio; returns `var(--color-brand-ink-light|dark)`), and delete the local `luminance` copy. `BrandTile.tsx` needs no change.
  2. Known limit: the dark ink token is `#04201C`, not pure black, so five strong mid-tone fills (YouTube and YouTube Music `#FF0000`, Adobe `#FA0F00`, Gym `#8B5CF6`, Ubisoft `#0070FF`) land at 4.0-4.4:1 with either token. Accept that (decorative, name beside it) rather than darkening brand colours.
  3. No SQL migration.
  4. Test in `src/lib/constants/brandTile.test.ts`: for every catalogue brand without a logo, the chosen ink is the higher-contrast of the two tokens and the ratio is at least 4.0. Fails for 32 brands today. Update the existing assertion at `:27-28` from `'white'`/`'black'` to the token strings.
- **Effort / risk:** S · About 30 tiles switch from white to dark letters; that is the intended visible change. Worth one look at the catalogue grid in both themes.
- **Related:** QA-113 (hardcoded colour literals).

### QA-111 · UI-009 · Floating Buddgy launcher covers row amounts and chevrons
- **Verdict:** UNSURE (behaviour confirmed; it is how the launcher was designed) · ticket P3 → my severity P3 · confidence high
- **Evidence:**
  - The launcher is a 56px fixed, draggable figure that rests at a screen edge and snaps left or right (`src/components/ai/AIChatBubble.tsx:23-26,96-124,177`). Its first-run position is the right edge at `top: 620` (`src/lib/store/useSettingsStore.ts:285`), clamped to `innerHeight - 150` (`AIChatBubble.tsx:26`), so on a phone it sits just above the bottom nav on the right, which is exactly where list rows put amounts and chevrons.
  - `main` reserves room only for the bottom nav (`AppShell.tsx:335`, `pb-[calc(4.5rem+safe-area)]`), so the last rows of a list cannot be scrolled clear of the figure.
  - It is not a layout slip: floating over content and being dragged out of the way is the documented behaviour of the component, and the user can drag it or turn Buddgy off. So this is a product choice, not a code defect.
- **Fix plan:** none until the owner picks an option. All three are small and none needs a new component:
  1. Default side left (`useSettingsStore.ts:285`): row icons are on the left, money on the right. Applies to new installs only; stored positions are kept.
  2. Extra end-of-list clearance in `main` (about 64px more bottom padding below `lg`) so the last row can scroll above the figure.
  3. Both.
- **Effort / risk:** S · Option 2 adds blank space at the bottom of every page.
- **Owner question:** The Buddgy figure sits over the right end of list rows by default. Keep as is (draggable), move its default to the left edge, add scroll clearance under lists, or both?
- **Related:** QA-117 (other floating layers over content).

### QA-112 · UI-010 · Truncated copy
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high (by layout arithmetic; no device run)
- **Evidence:**
  - Goal moment tiles: `src/components/features/goals/GoalsEmpty.tsx:98-99` puts title and subtitle in single-line `truncate` spans inside a two-column tile; about 100px is left for an 11px subtitle, so "3 months of spending" and "Down payment or full" (`en.ts:2840,2842`) cannot fit. In Arabic the span has an LTR base, so the ellipsis eats the start of the sentence instead of its end.
  - Subscriptions hero: `SubscriptionsHero.tsx:26` passes "Monthly equivalent" (`subscriptionsCopy.ts:210`) into a `HeroBand` cell label, which is a one-line uppercase `truncate` (`HeroBand.tsx:78`); a third of a 375px screen leaves about 97px for roughly 130px of text.
  - Security / privacy segments: `BalancePrivacyCard.tsx:32-33` puts four options (Off, Banners, Everywhere, Custom) in one `SegmentedControl`, whose segments have `px-4` and a `truncate` label (`SegmentedControl.tsx:90,104`). On 375px each label gets about 43px; "Banners", "Everywhere" and "Custom" all exceed it.
- **Fix plan:**
  1. `GoalsEmpty.tsx:99`: subtitle `truncate` → `line-clamp-2 leading-tight`, plus `dir="auto"` on both spans so Arabic clips at its end. Page-local markup, no primitive touched.
  2. Subscriptions hero label: copy change to "Per month" / "شهريًا" (`subscriptionsCopy.ts:210,440`), matching the "Per year" cell beside it. `HeroBand` unchanged.
  3. Privacy segments: shorten "Everywhere" to "All" / "الكل" (`en.ts:423`, `ar.ts:425`), and add an additive `density="compact"` option to `SegmentedControl` (`px-2` instead of `px-4`, default unchanged) used only by this four-option control, so "Banners" and "Custom" fit. If the owner prefers no new prop, the alternative is a row of `OptionChip` (wraps), which changes the look.
  4. No SQL migration.
  5. Tests: render `BalancePrivacyCard` and assert the compact density class on its segments while a default `SegmentedControl` snapshot is unchanged; dictionary test that the hero cell labels are at most 12 characters in English. Then a 375px check in both languages.
- **Effort / risk:** S · The two copy changes are visible wording changes; goal tiles with a two-line subtitle grow a few px taller than their neighbours.
- **Owner question:** OK to rename "Monthly equivalent" to "Per month" and "Everywhere" to "All"? (Otherwise the labels need a layout change instead.)
- **Related:** QA-27 (Arabic clipping direction).

### QA-113 · UI-011 · Hardcoded hex colours in src/components
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence high
- **Evidence:** Re-count at HEAD with the ticket's pattern (word-bounded, tests excluded): 89 matching lines in 21 files, up from 55/13 because the membership feature landed since. Sorted:
  - Not colours (14 lines): founder numbers and comments such as `"#023"` in `features/membership/*` (MembershipGallery 7, MemberCard, AvatarBadge, FounderSignatureCard, LetterpressTierCard), `features/rewards/useMemberMarks.ts` (2), and a comment in `ai/BuddgyIcon.tsx:49`.
  - Legitimate (70 lines): marketing site with its own palette (`components/site/*`, 38 lines in 5 files); Google's logo colours (`auth-modal/AuthOAuthButtons.tsx:113-125`); the buddget logo (`brand/BuddgetMark.tsx`, `brand/BuddgetWordmark.tsx`, four of the six are `var(--token, #fallback)`); membership card artwork (metal and foil gradients in `membership/tiers.ts`, `TierBadge.tsx`, `HotStreakCard.tsx`, 22 lines), which is illustration that is meant to look the same in both themes.
  - Real token violations (5 lines, 3 files): `auth/LandingGate.tsx:31` and `auth/WelcomeScreen.tsx:33` (`#12B0A0`), `WelcomeScreen.tsx:81,135` (`#fff`), `features/onboarding/StepAccounts.tsx:93` (`?? '#566B68'`).
  - The ticket's "breaks dark mode" does not hold for these five: the auth screens are a fixed dark canvas in both themes (`LandingGate.tsx:77-83` says so), and the `StepAccounts` fallback feeds `BrandMark`, which computes its own readable ink.
- **Fix plan:**
  1. `StepAccounts.tsx:93`: use the existing helper `accountColor(a.method)` from `features/accounts/accountDisplay.ts:37` (falls back to the payment type's colour), as `AccountRow` and `AccountPicker` do.
  2. `WelcomeScreen.tsx:81,135`: `#fff` → `var(--color-brand-ink-light)` (same value in both themes). `LandingGate.tsx:31`, `WelcomeScreen.tsx:33`: `#12B0A0` → `var(--color-brand-primary-bright)`.
  3. Add a guard so the count cannot grow again: a test beside `src/components/ui/noStyledRawButtons.test.ts` that scans `src/components` and `src/app/(app)` for hex colour literals and fails outside a short allowlist (site, brand, OAuth logos, membership artwork), ignoring `#` followed by digits inside quoted member numbers.
  4. No SQL migration. The guard test fails today on the five lines and passes after.
- **Effort / risk:** S · `LandingGate` is wrapped in `.dark`, so the accent there becomes the dark-theme teal `#1FC3B2` instead of `#12B0A0`; a slightly brighter accent on the sign-in screen.
- **Related:** QA-110.

### QA-114 · UI-012 · Untranslated strings in Arabic sheets
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence high for two items, low for the third
- **Evidence:**
  - "Cash EGP": confirmed. The built-in method is stored as the English word (`src/lib/store/defaultFinanceData.ts:31-38`, id `pm_default_cash`, name `'Cash'`) and shown raw: `PaymentMethodPicker.tsx:67` prints the stored name, then the currency code at `:70`. Same raw name in the ledger rows (`expenses/ExpenseDayList.tsx:187`, `flow/useFlowLedger.tsx:65`). The app already solves this exact problem for the system savings vault (`src/lib/savings/pocketIdentity.ts:22-24`, stored name kept, translated on display).
  - "Egyptian Pound": confirmed. `src/components/ui/CurrencyField.tsx:59-63` prints `meta.name`, the English name, in every locale, although `CURRENCY_META` has `nameAr` and a ready hook `useCurrencyName()` (`CurrencyList.tsx:29-32`) that the currency list uses. In the expense sheet the field is a 108px column (`ExpenseSheetForm.tsx:210`), so the name never fits and only pollutes the accessible text. "ج.م EGP" itself (sign plus code) is the intended trigger content.
  - "Amount label is doubled": not found in code. `ExpenseSheetForm.tsx:211` renders one label (`المبلغ`) and the input (`AmountTextInput`) adds no second name. Needs the screenshot to locate.
- **Fix plan:**
  1. Add a pure helper beside the payment-method name helpers in `src/lib/payment/paymentMethodDefaults.ts`, e.g. `methodDisplayName(m, cashLabel)`: when `m.id === DEFAULT_CASH_ID` and the stored name is still `'Cash'`, return the dictionary word (`typeCash`, `en.ts:402` / `ar.ts:404` "نقد"); otherwise the stored provider as today. A renamed method keeps the user's name. Use it at `PaymentMethodPicker.tsx:67`, `ExpenseDayList.tsx:187`, `useFlowLedger.tsx:65`. Stored data is not rewritten.
  2. `CurrencyField.tsx:61`: replace `meta.name` with `useCurrencyName()(value)`. In `ExpenseSheetForm.tsx:239` pass the existing `compact` prop so the name is not rendered in the 108px column at all (the passed `className` already fixes height and padding, so nothing moves).
  3. No SQL migration.
  4. Tests: unit test for the helper (default cash in Arabic gives "نقد"; a renamed cash method and a bank are unchanged); render `CurrencyField` under the Arabic locale and expect "الجنيه المصري", not "Egyptian Pound". Both fail today.
- **Effort / risk:** S · About 26 other call sites still print the stored name; they can move to the helper in a later sweep. The helper must not be used where the name is being edited.
- **Owner question:** Where exactly is the amount label doubled (which sheet, which control)? I could not find it in code.
- **Related:** QA-27.

### QA-115 · UI-013 · Two h1, unlabeled nav landmarks, content outside landmarks
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence med-high
- **Evidence:**
  - "Two h1 on every page" is a DOM count, not what a screen reader meets. `DesktopHeaderBar.tsx:23-27` (desktop header, `hidden lg:flex`) and `:41-52` (mobile header, `flex lg:hidden`) each hold an `h1`; one of the two headers is `display:none` at any width, so one `h1` is exposed. Notifications has one because both headers skip the title there.
  - A real double `h1` exists only on budget sub-views, which add their own under the shell title: `features/budget/SegmentPage.tsx:155`, `PlanFlow.tsx:148,204`, `builder/ManualBuilder.tsx:89`.
  - Nav landmarks: there are two `nav` elements in the shell, the sidebar's (`Sidebar.tsx:83`, no label) and the bottom bar's (`BottomNav.tsx:47`, labelled, `lg:hidden`). Only one is displayed per breakpoint, so they do not collide, but the desktop one has no name.
  - Content outside landmarks: true. The prompt and status layer is a plain fixed `div` beside `<main>` (`TopNoticeRegion.tsx:33-40`, mounted at `AppShell.tsx:346-348`), as are the sync banner and the Buddgy figure. Any route showing a prompt card has interactive content outside every landmark.
- **Fix plan:**
  1. `Sidebar.tsx:83`: add `aria-label={t.common.mainNavigation}` (string exists, `en.ts:224`).
  2. `TopNoticeRegion.tsx:33`: add `role="region"` and an `aria-label` (one new dictionary key, e.g. "Notices" / "التنبيهات"). No visual change.
  3. Budget sub-views: change the four in-page `h1` to `h2`, same classes. With the QA-45 change the shell's section title remains the single `h1`.
  4. Leave the two shell headers as they are.
  5. No SQL migration.
  6. Tests: extend `src/components/ui/a11yFixes.test.tsx`: sidebar `nav` has an accessible name; the notice region has `role="region"` with a name; `SegmentPage` renders no `h1`. All fail today.
- **Effort / risk:** S · Changing `h1` to `h2` drops those views back to the section name as tab title and announcement ("Budget") unless QA-45 keeps reading in-main headings of any level; decide that in the QA-45 change.
- **Related:** QA-45.

### QA-116 · UI-014 · Expense and Money-in sheets differ in gutters and chrome
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:**
  - Both sheets use the same header, `V3SheetHeader`, which insets 20px (`features/savings-v3/V3SheetHeader.tsx:79`, `px-5`).
  - Expense: body `px-5` (`ExpenseSheetForm.tsx:207`), footer `px-5 pt-3 pb-6` with a helper line when the form is incomplete (`:516-523`), date pill is `OptionChip size="sm"` (36px, `:194-203`).
  - Money in: body `px-4` (`modals/IncomeSheetForm.tsx:228`), footer `px-4 pb-5 pt-4` with no helper line (`:372`), date pill is a `DatePickerField` forced to 32px (`:223`). So Money in is also misaligned with its own header (20px title over 16px fields).
- **Fix plan:**
  1. `IncomeSheetForm.tsx:228` and `:372`: `px-4` → `px-5`, matching the shared header and the expense sheet.
  2. `IncomeSheetForm.tsx:223`: replace the shrunken `DatePickerField` with the expense sheet's pattern, `OptionChip as="trigger" size="sm"` with the calendar glyph and `formatDatePillLabel`, opening `UnifiedDatePicker` (all three already exist and are used at `ExpenseSheetForm.tsx:194-203,546`). Same fix as QA-109 item 2.
  3. Leave the footer helper line alone unless the owner wants it on Money in too; it is copy, not layout.
  4. No SQL migration.
  5. Test: render both forms and assert the body and footer wrappers carry `px-5` and the date trigger is an `OptionChip`; add `IncomeSheetForm` to whatever the sheet-header guard (`src/components/ui/sheetHeaders.test.ts`) can check for gutters. Fails today for Money in.
- **Effort / risk:** S · Money-in fields get 8px narrower in total; check the two-column rows at 320px.
- **Owner question:** Should Money in also show the "Enter an amount to continue" helper line above its button, like the expense sheet? (Yes / leave as is.)
- **Related:** QA-109.

### QA-117 · UI-015 · Zakat prompt covers the Wealth header; tablet shows a stretched phone layout
- **Verdict:** UNSURE (both halves are designed behaviour that needs an owner decision) · ticket P3 → my severity P3 · confidence high on the facts
- **Evidence:**
  - Zakat card: it is not misplaced. Every question in the app drops down from the top through one stack that is built to overlay the page, not push it (`features/dashboard/BannerStack.tsx:24-33`, layer at `layout/TopNoticeRegion.tsx:33-37`, `fixed` under the status bar, `z-[58]` above the `z-40` header). The close button and swipe-up snooze it for 3 hours.
  - What makes this card stand out: it is tall, because its text joins five sentences (`features/savings-v3/ZakatBasisPrompt.tsx:47`: status line, hadith, source, jurists' note, nisab figures), and it is registered for every user on every Wealth visit until answered (`src/app/(app)/wealth/page.tsx:268`, only condition is a gold price), including users under both nisab lines (`context: 'none'`) for whom the choice changes nothing today. It comes back 3 hours after each snooze.
  - Tablet: by design there is one layout below `lg` (1024px) and a sidebar layout from `lg` (`layout/PageGrid.tsx:22-27`, `PageContainer.tsx:6-12`); hero bands are full-bleed and the wide container caps at 72rem (`globals.css:109-110`), so at 768px rows run edge to edge. Nothing is broken; there is simply no tablet design.
- **Fix plan:** none until decided. If the owner picks the smaller options below, both are S and reuse what exists: (1) pass only the status line and the nisab figures as the prompt description and move the hadith and jurists' note into the Zakat sheet it already opens; (2) register the prompt only when the basis changes the result (`context === 'silverOnly'`), or only after the user opens Zakat once.
- **Effort / risk:** S for the prompt options · a tablet layout is L and a design task, not a bug fix.
- **Owner question:** (1) Zakat question: keep as is, shorten the card, and/or show it only to users whose zakat result depends on the answer? (2) Tablets (768-1023px): accept the stretched phone layout for launch, cap the content column at a phone-like width and centre it, or commission a tablet layout?
- **Related:** QA-111, QA-115 (same top layer).



## 6.9 Native and PWA

### QA-21 · NAT-001 · Biometric sign-in secret stored in plain Preferences
- **Verdict:** CONFIRMED · ticket P2 → my severity P2 · confidence high
- **Evidence:**
  - `src/lib/native/biometricAuth.ts:250` saves the 256-bit device secret with `Preferences.set` (key `buddget.biometric.secret`); `:310-318` runs `authenticate()` in JS, reads the secret back with `Preferences.get` and posts it to `/api/biometric/signin`, which answers with the account email and a one-time code for a full new session (`src/app/api/biometric/signin/route.ts:61-92`); the client then marks the second factor as passed (`biometricAuth.ts:332`). This is the current design: the LockScreen local lock is a separate path, and no Supabase token is stored. The ticket describes today's code, not an older design.
  - The device id the server pairs with the secret is also in Preferences (`src/lib/native/deviceId.ts:26`), so both halves of the credential sit in the same plain store. iOS: UserDefaults is part of Finder/iCloud device backups, so a backup is enough to sign in from another machine with no biometric and no 2-step. Android: `allowBackup="false"` and shared prefs are excluded (`android/app/src/main/res/xml/backup_rules.xml`), so it needs root or a debuggable build; the distributed APK is `assembleDebug` (`scripts/native-release.sh:73`, merged manifest `debuggable="true"`), where `adb run-as` can read the file.
  - The trusted-device secret already moved to Keychain / EncryptedSharedPreferences (`src/lib/native/deviceSecret.ts`, native `setDeviceSecret` in `SmsCapacitorPlugin.kt:160-177` and `SmsCapacitorPlugin.swift:81-97`); the biometric secret was left behind.
  - Same root cause, not in the ticket: the admin-portal unlock secret, `src/lib/native/adminBiometric.ts:40,47` (key `buddget.admin.biometric.secret`), also plain Preferences.
  - Limit of the fix: secure storage closes the at-rest and backup exposure. The prompt stays a JS-level gate, because `@aparajita/capacitor-biometric-auth` returns no key or crypto object and the call uses `androidBiometryStrength: 'weak'`.
- **Fix plan:**
  1. Native, both plugins (`android/app/src/main/java/app/buddget/SmsCapacitorPlugin.kt`, `ios/App/App/SmsCapacitorPlugin.swift`): add `setSecureItem({key,value})`, `getSecureItem({key})`, `removeSecureItem({key})` backed by the existing `SmsStore.prefs` / `SmsKeychain`, accepting only the keys `biometric_secret` and `admin_biometric_secret`. Add them to the iOS `pluginMethods` list. `clearCredentials`, `clearState` and iOS `clear()` remove named keys only, so they already leave these alone.
  2. `src/lib/native/smsTracker.ts`: three wrappers next to `setSecureDeviceSecret`, using the existing `callNative`.
  3. `src/lib/native/biometricAuth.ts`: replace the five `Preferences` uses of `SECRET_KEY` (`:250`, `:267`, `:274`, `:299`, `:311`) with the wrappers, with the same one-time migration `deviceSecretHeader()` uses (read secure; if empty read the legacy Preferences value, write it to secure, remove the legacy copy only after the write succeeded). `registerBiometric` returns `'error'` when the secure store is unavailable (no plain fallback). When `biometricSignIn` finds no secret, call `clearLocalBiometric()` so the toggle does not stay on with nothing behind it (covers the Android Keystore key-loss wipe in `SmsStore.open`).
  4. `src/lib/native/adminBiometric.ts`: same swap for the admin secret.
  5. No SQL migration.
  6. Tests: in `src/lib/native/biometricRegister.test.ts` add "keeps the secret in the secure store, never in Preferences" (fails today: `Preferences.set` is called with `buddget.biometric.secret`), plus the migration cases copied from `src/lib/native/deviceSecret.test.ts:51-64`; in `src/lib/native/nativeHardening.test.ts` add a static check that both plugins expose the three methods and that `clearState` does not touch the two keys.
  7. Takes effect only in the next native build (the JS bundle ships inside the binary, so JS and native cannot be out of step). Enrolled users migrate on their next biometric sign-in.
  - Optional later step (L, separate change): bind the secret to biometrics in the OS (Keychain access control `.biometryCurrentSet`, Android Keystore `setUserAuthenticationRequired`) so the prompt becomes a real gate. Needs custom native code and class-3 biometrics only.
- **Effort / risk:** M · a migration mistake silently un-enrols users (they re-enable with their password); an Android Keystore reset drops the secret (handled by step 3).
- **Related:** QA-72 (the Android store this moves the secret into).

### QA-66 · NAT-002 · No deep-link / App Link handling
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:**
  - `android/app/src/main/AndroidManifest.xml:25-28` has only the LAUNCHER filter; `ios/App/App/App.entitlements` lists only `webcredentials:`; `public/.well-known/apple-app-site-association` has only a `webcredentials` block; no `appUrlOpen` / `getLaunchUrl` anywhere in `src`.
  - Half the plumbing exists: `ios/App/App/SceneDelegate.swift:17` forwards universal links to Capacitor, `public/.well-known/assetlinks.json` already grants `handle_all_urls` to `app.buddget`, and `next.config.ts:33` serves the AASA file.
  - The old `app.buddget://auth/callback` custom scheme was removed on purpose in QA round 6 (SUP-15, `docs/qa-round-6/closing-p3-supply.md:18`) because unverified schemes can be claimed by any app. Do not bring it back.
  - Impact is smaller than the ticket says: sign-up and password reset use 6-digit codes inside the app, not links (`src/hooks/useAuthModal.ts:423`, `:631`). The real gap today is invite links: `buddget.app/i/CODE` (`src/app/i/[code]/route.ts`) stores the code in a browser cookie, which the installed app never sees, so the invited person must type the code (`InviteCodeField`).
- **Fix plan:**
  1. Agree the path list (recommend `/i/*` only; never `/api/*`, `/auth/*`, `/admin*`).
  2. Android: second intent-filter on `MainActivity` with `android:autoVerify="true"`, `VIEW` + `DEFAULT` + `BROWSABLE`, `https://buddget.app`, `pathPrefix="/i/"`. Check that the SHA-256 in `assetlinks.json` belongs to the key that signs the distributed build (today a debug key; add the Play App Signing key when the app goes on Play).
  3. iOS: add `applinks:buddget.app` to `App.entitlements` and an `applinks` block for `/i/*` to the AASA file (the store profile already carries Associated Domains).
  4. JS: one listener in `src/lib/native/NativeBootstrap.tsx` (`App.addListener('appUrlOpen')` plus `App.getLaunchUrl()` for cold start). Accept only `buddget.app` URLs, pass the path through the existing `safeInternalPath` (`src/lib/auth/postAuthRedirect.ts:4`), and for `/i/CODE` run `normalizeInviteCode` and store the code where the sign-up sheet already reads it (`src/components/features/invite/inviteCode.ts`), then open the sign-up sheet.
  5. No SQL migration.
  6. Tests: unit test for the URL-to-action parser (other host, path outside the list, malformed code all rejected); static test that the manifest filter has `autoVerify` and only the `/i/` prefix.
  7. Needs the next native build plus a web deploy of the AASA file; Apple caches that file for a day or more.
- **Effort / risk:** L (device testing on both platforms) · a path list that is too wide pulls web-only flows (OAuth callback, admin sign-in) into the app.
- **Owner question:** Which links should open the installed app at launch: invite links only (recommended), or others as well?
- **Related:** none in this slice.

### QA-67 · NAT-003 · CAMERA and RECEIVE_SMS without uses-feature required="false"
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:**
  - `android/app/src/main/AndroidManifest.xml:86-87` declares `RECEIVE_SMS` and `CAMERA`; the file has no `<uses-feature>` element.
  - No plugin adds one either: the last locally built merged manifest (main checkout, `android/app/build/intermediates/merged_manifests/debug/.../AndroidManifest.xml`, 16 Nov) contains zero `uses-feature` lines.
  - Play therefore infers `android.hardware.camera` and `android.hardware.telephony` as required and hides the app from devices without them. Both features are optional in the app (receipt scan and SMS tracking are opt-in).
  - No effect today: Android is distributed as an APK through Drive, where Play filtering does not apply. It matters from the first Play upload.
- **Fix plan:**
  1. `android/app/src/main/AndroidManifest.xml`: add, next to the permissions, `<uses-feature android:name="android.hardware.camera" android:required="false" />`, the same for `android.hardware.camera.autofocus`, and the same for `android.hardware.telephony`.
  2. No code change needed for SMS: the receiver simply never fires without telephony. For the camera, check how the receipt-scan entry point behaves with no camera (I did not trace this); if it does not fail cleanly, hide the scan button when the scanner reports unavailable.
  3. No SQL migration.
  4. Test: add a static check to `src/lib/native/nativeHardening.test.ts` that the manifest declares the three features with `required="false"` (fails today).
  5. Takes effect in the next native build.
- **Effort / risk:** S · none for phones; on a tablet without a camera the scan button must fail cleanly.
- **Related:** QA-68 (same manifest block, ship together).

### QA-68 · NAT-004 · Possibly unneeded permissions MODIFY_AUDIO_SETTINGS, USE_FINGERPRINT
- **Verdict:** NOT-A-BUG · ticket P3 → my severity none for the two named permissions · confidence high (USE_FINGERPRINT), med (MODIFY_AUDIO_SETTINGS)
- **Evidence:**
  - `USE_FINGERPRINT`: the app supports Android 7 (`android/variables.gradle` `minSdkVersion = 24`), and on API 24-27 the biometric prompt runs on the old fingerprint API, which needs this permission. It is also merged in by the library regardless of the app's own line: the manifest-merger report of the last local build shows `uses-permission#android.permission.USE_FINGERPRINT ... MERGED from [androidx.biometric:biometric:1.1.0]` (pulled by `@aparajita/capacitor-biometric-auth`, `node_modules/@aparajita/capacitor-biometric-auth/android/build.gradle:53`). Deleting the app's line changes nothing in the shipped manifest.
  - `MODIFY_AUDIO_SETTINGS`: the caller is not in `src/` or Kotlin because it is Chromium inside the WebView. Voice input records through `getUserMedia` (`src/lib/native/voiceRecorder.ts:48,82`), and the WebView's audio manager uses this permission to switch audio mode and routing (headsets) during capture. It is the standard pair with `RECORD_AUDIO` for WebView capture. This part is from platform knowledge, not provable from the repo.
  - Both are normal (install-time, no prompt) permissions and are not data types in the Play Data safety form, so the "shows up in the data-safety review" concern does not apply.
  - Cost of removing either: `src/lib/legal/storeDocs.test.ts:13-17` requires `docs/GOOGLE_PLAY_SUBMISSION.md` section 2 to list exactly the manifest permissions, so any change must edit both.
  - Real finding the ticket missed, same area: the merged manifest of the last local build carries `com.google.android.gms.permission.AD_ID` and four `ACCESS_ADSERVICES_*` permissions, merged from `com.facebook.android:facebook-core:18.1.3`. That SDK comes from `@capgo/capacitor-social-login`, whose `android/build.gradle:9` includes Facebook unless `socialLogin.facebook.include` is set to false; `android/gradle.properties` does not set it and the app has no Facebook sign-in. This contradicts `docs/GOOGLE_PLAY_SUBMISSION.md:80` ("no ... advertising-ID ... permission anywhere in the app") and `docs/STORE_PRIVACY.md:6`. Play asks for an advertising-ID declaration when this permission is present. I rate this P2 before a Play upload.
- **Effort / risk:** nothing to do for the two named permissions. For the advertising-ID permissions: S · add `socialLogin.facebook.include=false` to `android/gradle.properties` (the plugin then compiles its stub classes instead of the Facebook SDK), rebuild, and confirm in the merger report that `AD_ID` and `ACCESS_ADSERVICES_*` are gone and Google sign-in still works; add a static test that the property is set. Next native build.
- **Owner question:** Do you want the advertising-ID finding raised as its own ticket? It is outside what QA-68 describes.
- **Related:** QA-67.

### QA-69 · NAT-005 · WebView microphone grant not origin-scoped
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:**
  - `android/app/src/main/java/app/buddget/MainActivity.kt:22-40` grants `RESOURCE_AUDIO_CAPTURE` to any `PermissionRequest` once the app holds `RECORD_AUDIO`; `request.origin` is never read. The deferred path (`:50-58`) grants the stored request the same way.
  - Exposure today is small: the WebView loads the bundled app from `https://localhost` and may only navigate to `buddget.app` / `*.buddget.app` (`capacitor.config.ts:19`). The gap would matter for an embedded third-party frame or a future added origin.
- **Fix plan:**
  1. `MainActivity.kt`: before either `grant` call, require `request.origin` to be `https` with host `localhost` (the bundled app; voice input only runs there) and call `request.deny()` otherwise. Put the check in a small pure function (same style as `SmsApiUrl.kt`) so it can be unit tested.
  2. Tests: a JUnit test beside `android/app/src/test/java/app/buddget/SmsApiUrlTest.kt` (localhost allowed; `https://evil.example`, `http://localhost`, null origin denied), and a static line in `src/lib/native/nativeHardening.test.ts` that `MainActivity.kt` checks `request.origin` before `grant` (fails today).
  3. No SQL migration. Next native build.
- **Effort / risk:** S · if the allowed host is wrong, voice input stops working on Android; test on a device before release (the Capacitor host is `localhost` because no `server.hostname` is set).
- **Related:** none.

### QA-70 · NAT-006 · SmsForwardWorker retries terminal 4xx forever
- **Verdict:** NOT-A-BUG · ticket P3 → my severity none (comment tidy only) · confidence high
- **Evidence:**
  - The behaviour is real and deliberate. `android/app/src/main/java/app/buddget/SmsForwardWorker.kt:121-126` returns `Result.retry()` for other 4xx, and commit `93ba2254` (13 Nov, "a refused message is parked, not lost") changed that line from `Result.failure()` with the comment "only a 2xx ever removes it". The in-app drain follows the same rule with a 6-hour cap for such messages (`src/lib/native/smsRetryState.ts:19-26`).
  - It is bounded: WorkManager's exponential backoff tops out at 5 hours (about 5 requests a day per stuck message); a job whose message has left the queue ends at once (`SmsForwardWorker.kt:65`); the queue holds at most 200 items and drops anything older than 30 days (`PendingSmsQueue.kt:124-134`, `SmsGate.kt:93-103`).
  - A permanent message-specific 4xx is close to unreachable: `/api/sms/parse` only answers 401, 429, 413 and 400-invalid-JSON as 4xx (`src/app/api/sms/parse/route.ts:679-705`), and it acknowledges a body with no usable message with a 2xx "so the phone can drop it instead of resending it forever" (`:707-709`). The worker caps the body at 2000 characters against a 64 KB limit and escapes its JSON itself.
  - Leftover from before that change: two comments still describe the old behaviour, `SmsGate.kt:114` ("false = leave queued without retrying") and the class header `SmsForwardWorker.kt:26-27` ("terminal 4xx"). Worth correcting the next time the file is touched; no behaviour change.
- **Related:** none.

### QA-71 · NAT-007 · Business-sender SMS with a digit forwarded in "sender" mode
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence high
- **Evidence:**
  - Behaviour as described and intended: `android/app/src/main/java/app/buddget/SmsGate.kt:81-87` forwards `(isBusinessSender && hasDigit) || isBankishMessage` after the OTP/marketing drop; `SmsReceiver.kt:56-59` defaults the mode to `"sender"` and documents it as the Phase 1 choice; `SmsGateTest.kt:58` pins it. Nothing in `src` ever calls `setSmsForwardMode`, so every Android user is in `"sender"` mode.
  - It is disclosed to Google: the Play SMS declaration says the app "keeps only messages from business senders or that match transaction keywords" (`docs/GOOGLE_PLAY_SUBMISSION.md:95-97`). Non-transactions are rejected server-side with a 2xx and kept at most 7 days, which the policy states.
  - The part that remains: the public privacy policy says only "the text content of bank notification SMS messages you authorize is transmitted" (`src/app/(app)/legal/privacy/sections/PrivacyDataSections.tsx:57-58`, and the Arabic copy under `sections/ar/`), and the in-app toggle hint says "bank SMS messages" (`src/lib/i18n/dictionaries/en.ts`, `smsTracking.toggleHint`). Delivery notices, telecom balance texts and similar from alphanumeric senders also leave the phone. The wording is narrower than the behaviour.
- **Fix plan:** (depends on the owner's answer)
  - Option A, keep the wide gate (keeps learning new banks):
    1. Change the policy sentence in `PrivacyDataSections.tsx` (EN and AR) to say that messages from business senders that contain a number, and messages that look like a transaction, are sent, and that the ones that are not transactions are rejected and deleted within 7 days. Align `smsTracking.toggleHint` in `en.ts` / `ar.ts`.
    2. Test: extend `src/lib/legal/privacyClaims.test.ts` to require the phrase "business senders" in the policy section (fails today). Web deploy only, no native build.
  - Option B, tighten the gate:
    1. `SmsGate.shouldForward`: in `"sender"` mode require a currency amount or a money verb as well (`currencyRegex` or `moneyVerbRegex`, both already in the file) instead of any digit. `src/lib/sms/deviceOtpGate.ts` and the iOS gate mirror only the OTP and currency lists, so they need no change.
    2. Tests: update `SmsGateTest.kt:58-61` (a delivery notice with a tracking number from an alphanumeric sender is not forwarded; "You received 500 from Ahmed" from `VF-Cash` still is). Next native build.
  - No SQL migration either way.
- **Effort / risk:** A: S, no functional risk. B: S to write, but real risk of silently dropping bank texts that state an amount without a currency code or known verb; those would never reach the server or the learning funnel.
- **Owner question:** Keep the wide Android gate and correct the privacy wording (A, recommended while the template funnel is still learning banks), or tighten the on-device gate and accept missed messages from banks with unusual wording (B)?
- **Related:** QA-75 (same question on iOS).

### QA-72 · NAT-008 · Alpha androidx.security:security-crypto
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:**
  - `android/app/build.gradle:74` pins `androidx.security:security-crypto:1.1.0-alpha06`; `SmsStore.kt:71-78` uses its `MasterKey` and `EncryptedSharedPreferences` for the ingest token, the pending SMS queue and the trusted-device secret.
  - Google's Maven index now lists a stable `1.1.0` (published 30 Jul 2025; versions after alpha06 are alpha07, beta01, 1.1.0). The library is deprecated upstream as a whole, stable included, so "alpha" is fixable now and "deprecated" is a longer-term item.
  - No defect today. `SmsStore.open` already recovers from an unreadable store by starting clean and asking the app to re-save the token (`SmsStore.kt:34-49`).
- **Fix plan:**
  1. `android/app/build.gradle:74`: change the version to `1.1.0`. Same classes; the on-disk format is expected to be unchanged (not verified here, step 2 checks it); expect Kotlin deprecation warnings only.
  2. Verify on a device that had the previous build installed: after the update the SMS token and a queued SMS are still readable (the settings screen must not show "needs resync").
  3. Leave the move to Tink + DataStore until Google announces removal or a break appears; it needs a re-encryption migration for the token and the queue and is not worth the risk now.
  4. No SQL migration, no JS change. Test: static check in `src/lib/native/nativeHardening.test.ts` that the gradle line has no `-alpha` / `-beta` suffix (fails today). Next native build.
- **Effort / risk:** S · if the stable build could not read the old file, every Android user's token and queued SMS would be wiped once and re-synced on next app open (queued unsent SMS would be lost). Step 2 exists to catch that before release.
- **Related:** QA-21 (adds two more secrets to this store).

### QA-73 · NAT-010 · iOS aps-environment is "development" in the entitlements file
- **Verdict:** NOT-A-BUG · ticket P3 → my severity none · confidence high
- **Evidence:**
  - The source value is as described: `ios/App/App/App.entitlements` has `aps-environment = development`, used by both configurations (`project.pbxproj:340,368`).
  - The release path re-signs for the store: `scripts/native-release.sh:61-70` archives with automatic signing and exports with `ios/App/ExportOptions.plist` (`method = app-store-connect`, `signingStyle = automatic`).
  - Proof from a real upload made today (18 Nov, 20:25): Xcode's distribution log for that export, `$TMPDIR/App_2026-11-18_20-25-36.341.xcdistributionlogs/IDEDistributionPipeline.log`, shows the archived app signed with "Apple Development" and `aps-environment = development`, and then the entitlements computed for the exported app: `"aps-environment" = production; "beta-reports-active" = 1;`, signed with "Apple Distribution" under "iOS Team Store Provisioning Profile: app.buddget". The build that reaches TestFlight carries the production value.
  - That log sits in a temp folder and will be cleaned up; the check can be repeated after any upload by searching the newest `*.xcdistributionlogs/IDEDistributionPipeline.log` for `aps-environment`.
- **Related:** none.

### QA-74 · NAT-011 · iPad allows all orientations
- **Verdict:** UNSURE · ticket P3 → my severity P3 · confidence med
- **Evidence:**
  - True as stated: `ios/App/App/Info.plist:78-84` lists all four orientations for iPad, iPhone is portrait only (`:74-77`), and the target is built for iPhone and iPad (`project.pbxproj:359,386`, `TARGETED_DEVICE_FAMILY = "1,2"`).
  - The ticket's suggested fix (restrict iPad to portrait) is not a simple edit: an iPad app that does not support all four orientations must also declare `UIRequiresFullScreen`, or App Store upload is rejected, and Apple has deprecated that key from iOS 26. The platform direction for iPad is all orientations and resizable windows.
  - Landscape is not an unknown layout: at 1024 px and wider the web layer switches to the desktop layout with the sidebar (`src/components/layout/AppShell.tsx:335`, `lg:` classes), the same one the website uses. What has not been checked is that layout inside the native shell on an iPad (safe areas, sheets, native-only flows). That needs a simulator or device, which I could not use.
- **Fix plan:** (after the owner's answer)
  - If iPad stays supported: no code change. Run one pass on an iPad simulator in portrait and landscape (sign-in, add expense, a bottom sheet, receipt scan, settings) and file what breaks.
  - If the app should be iPhone-only: set `TARGETED_DEVICE_FAMILY = 1` in both configurations of `ios/App/App.xcodeproj/project.pbxproj` and delete the `UISupportedInterfaceOrientations~ipad` block; on an iPad the app then runs as a scaled iPhone app in portrait. This must be decided before the first App Store release, because Apple does not allow removing iPad support from a released app. Next native build; no SQL migration; static test in `nativeHardening.test.ts` on the device-family value.
- **Effort / risk:** S for either · iPhone-only gives iPad users a small scaled window; keeping iPad means owning the landscape layout.
- **Owner question:** Is iPad a supported device at launch? (a) Yes: keep all orientations and do a simulator pass. (b) No: ship iPhone-only now, before the first App Store release locks the choice.
- **Related:** QA-77 (the PWA `orientation: "portrait"` is the same decision for tablets on the web).

### QA-75 · NAT-012 · iOS SMS capture has no sender gate
- **Verdict:** NOT-A-BUG · ticket P3 → my severity none (platform limit, already documented) · confidence high
- **Evidence:**
  - iOS gives the app no sender. The Shortcuts action receives only the message text (`ios/App/App/CatchBankSmsIntent.swift:16-23`; the `sender` parameter is kept only for old Shortcuts, with the note that 0 of 824 production messages carried one). The on-device gate is therefore wording only (`SmsOtpGate`, `:141-180`, with the comment "the Shortcut has no sender, so no sender gate").
  - What leaves the phone is bounded by the user's own automation filter: the setup guide has them set "Message Contains" to their currency code and leave Sender on Any (`src/components/onboarding/sms/ShortcutsScenes.tsx:78-91`), because bank senders are alphanumeric IDs that the Shortcuts sender filter cannot select. The in-app copy already says what the filter does (`smsTracking.iosKeywordsPrivacy`).
  - Android is not stricter against a hostile texter: `SmsGate.shouldForward` also forwards a message from a personal number when it looks like a transaction (`|| isBankishMessage(body)`, `SmsGate.kt:86`). On both platforms anyone who can text the user can reach the server parser, so the control has to be server-side (the SMS-011 ticket in another slice). Nothing on the device can close this on iOS.
  - I do not recommend adding an Android-style "looks bankish" check to the iOS intent: its currency list has ten codes, and a bank text in any other currency would be dropped on the phone with no trace.
- **Related:** QA-71; the server-side SMS-011 ticket (prompt-injection guards) is where this is actually handled.

### QA-76 · NAT-013 · PWA display_override starts with "fullscreen"
- **Verdict:** UNSURE · ticket P3 → my severity P3 · confidence med
- **Evidence:**
  - `public/manifest.json:7-12` is `["fullscreen", "standalone", "minimal-ui"]` with `"display": "standalone"`.
  - The order was chosen on purpose: commit `edb74674` (30 Mar, "fix(pwa): edge-to-edge display ... Prefer fullscreen via display_override with standalone fallbacks") added it together with `viewportFit: 'cover'` and the safe-area padding, to let the app draw to the top edge. `src/hooks/usePWAInstall.ts:23` treats fullscreen as an installed mode.
  - The side effect is the one the ticket names: an installed Android PWA hides the system status bar (clock, battery, signal). Desktop Chrome and iOS ignore `fullscreen` and fall through to standalone, so only Android installs are affected. I could not check an installed PWA on a device.
  - Whether hiding the status bar is wanted is a design choice; the code cannot tell me. The native apps are the main channel, so few users see this.
- **Fix plan:** (only if the owner wants the status bar back)
  1. `public/manifest.json`: reorder to `["standalone", "minimal-ui"]` (drop `fullscreen`; `display` already says standalone).
  2. Check on an installed Android PWA: the status bar takes the manifest `theme_color` (brand teal `#12B0A0`) above a dark app (`background_color #0A100F`); if that looks wrong, the status-bar colour needs a separate decision.
  3. Test: add to `src/lib/pwa/manifestAssets.test.ts` that `display_override[0]` is `standalone` (fails today). Web deploy only; installed PWAs pick it up on Chrome's next manifest refresh.
  4. No SQL migration.
- **Effort / risk:** S · the top safe-area padding was tuned for fullscreen; check the header spacing in standalone.
- **Owner question:** On an installed Android PWA, should the phone's status bar be visible (standalone) or hidden as now (fullscreen, the original edge-to-edge choice)?
- **Related:** QA-77 (same file, one change).

### QA-77 · NAT-014 · PWA manifest gaps
- **Verdict:** PARTIAL · ticket P3 → my severity P3 · confidence high
- **Evidence:** (`public/manifest.json`, linked from `src/app/(app)/layout.tsx:97,143`)
  - Real, worth fixing: no `id`. Install identity then follows `start_url`, and that has already changed once (`/` to `/flow`, commit `e5feddf5`), which makes existing installs look like a different app to Chrome. No `categories`. No `screenshots`, so Chrome shows the plain install prompt instead of the richer one.
  - Cosmetic: no `lang` / `dir`. These describe the manifest's own strings (name "buddget", an English description), not the app's language; the app sets its language at runtime. Adding `"lang": "en", "dir": "ltr"` is correct and changes nothing visible.
  - Deliberate, not gaps: `"orientation": "portrait"` matches the phone-first layout and the iPhone setting; the single shortcut is the result of QA round 6 removing "Log a Purchase" because nothing read its URL (OFS-11, `docs/qa-round-6/closing-p3-ui.md:25`; pinned by `src/lib/pwa/manifestAssets.test.ts`).
- **Fix plan:**
  1. `public/manifest.json`: add `"id": "/flow"` (equal to today's `start_url`, so current installs keep their identity and future `start_url` changes no longer break it), `"lang": "en"`, `"dir": "ltr"`, `"categories": ["finance"]`.
  2. Screenshots: add three or four phone PNGs (`form_factor: "narrow"`) and one desktop PNG (`form_factor: "wide"`) under `public/screenshots/` and list them. Reuse the store review screenshots if their sizes fit; this is the only part that needs assets.
  3. Leave `orientation` as is unless the owner wants tablets and desktop installs to rotate (then remove the key; the `lg:` desktop layout already exists).
  4. Test: extend `src/lib/pwa/manifestAssets.test.ts`: `id` equals `/flow`, `categories` present, every `screenshots[].src` file exists (fails today on all three). Web deploy only, no native build, no SQL migration.
- **Effort / risk:** S without screenshots, M with them · setting `id` to anything other than the current `start_url` would orphan existing installs.
- **Owner question:** Should tablet and desktop PWA installs be allowed to rotate (remove `orientation`), or stay portrait-locked like the phone apps?
- **Related:** QA-76 (same file), QA-74 (same tablet decision on iOS).


## 6.10 Performance

### QA-22 · PERF-001 · First sign-in downloads the whole dataset twice; every page load runs two pulls
- **Verdict:** PARTIAL · ticket P2 → my severity P3 · confidence high (first sign-in), med (later loads)
- **Evidence:** First sign-in half is real and still present. The cold mount pull calls `runFullSync(supabase, userId, null)` directly, outside the `reconciling` lock (`src/components/sync/SupabaseFinanceSync.ts:246`). On a password sign-in from a trusted device, `signIn()` then calls `useSecondFactorGate.getState().resolve()` after `/api/auth/device/check` (`src/hooks/useAuthModal.ts:339`); the sync listens for that (`SupabaseFinanceSync.ts:371-374`) and runs `pendingSync`, whose `flush()` is a no-op before hydration (`:300`) and whose `runFullSync` sees no local copy yet, so `since = null` (`:568-569`) and a second full `sync_pull_v2` starts while the first is in flight. Both merges are idempotent, so the cost is bytes and one extra full RPC on the small DB, not data. The "two pulls on every later load" half is not reproducible from code at HEAD: the warm boot makes one reconcile (`:217-219`) behind the `reconciling` lock (`:388-392`), and since `67e8e03d` it first asks `sync_changed_since` and skips the pull when nothing changed (`:572-575`, `src/lib/supabase/remote/delta.ts:99`). The probe leaves the cursor untouched when nothing changed, so a constant `p_since` on the probe is by design. Severity lowered: the 2 x 3.1 MB figure is a 3,000-expense account; a typical tester (hundreds of rows) pays a few hundred KB once per sign-in.
- **Fix plan:**
  1. `src/components/sync/SupabaseFinanceSync.ts`: keep the cold pull's promise in a ref (set where `pull()` starts the `runFullSync` at `:246`, cleared in its `finally`). At the top of `pendingSync` (`:384`), `await` that promise if present before entering the loop. The resumed run then finds a local copy and a cursor, so the probe answers "unchanged" and nothing is downloaded twice. Do not simply return when not hydrated: the second-factor resume exists to recover a first pull that was refused, and that must still run.
  2. No SQL migration.
  3. Test in `src/components/sync/financeSync.test.ts`: mount with an empty store, hold the `sync_pull_v2` mock pending, fire the second-factor resolve (or `syncFinanceNow()`), release; expect `sync_pull_v2` called once. Fails today (called twice), passes after.
  4. Retest the warm-load claim on a production build after the fix; if two `sync_pull_v2` calls still appear on an unchanged reload, capture which caller (stack) before changing anything.
- **Effort / risk:** S · the resume-after-second-factor path now waits for the first pull; a first pull that hangs would delay it (the pull already has the 8 s splash ceiling but no abort, so keep the await bounded by the same promise settling, not a new timeout).
- **Related:** QA-84 (suspected to be the same double-merge landing during first paint).

### QA-78 · PERF-002 · 3,000 expenses make Flow/Expenses main-thread heavy
- **Verdict:** PARTIAL · ticket P3 → my severity P3 (watch) · confidence med
- **Evidence:** "Lists are not virtualized" is literally true (no windowing library in `package.json`), but the ledger is already bounded twice: only rows inside the selected range are built (`src/components/features/flow/useFlowLedger.tsx:191-194`), and only 40 day-groups render before "Show more" (`src/components/features/flow/FlowLedger.tsx:43,56`; in place since `1e0fc022`, before the audit). The measured 3,172 DOM nodes is one month of the synthetic account (roughly 250 rows), not 3,000 rows. Real remaining costs with a large store: an unconditional `[...expenses].sort(localeCompare)` over every expense on each ledger recompute, used only for offline SMS previews (`useFlowLedger.tsx:414-417`); the whole ledger remounts on any segment/filter/month change because `FlowLedger` is keyed on `fadeKey` (`FlowLedger.tsx:50`, `src/app/(app)/flow/page.tsx:331`), which matches the 1.18 s INP on a tap; rows are not memoised. `/expenses` and `/income` are the same view (`src/components/layout/AppViewRouter.tsx:32-33`). At current scale (hundreds of expenses, tens of rows per month) none of this is felt.
- **Fix plan:**
  1. `useFlowLedger.tsx:414`: build `pastCategory` only when `previews.length > 0`. Removes a full sort of the expense list from every recompute for everyone who has no pending offline SMS. Test: add a case to `src/components/features/flow/FlowLedger.test.ts` (or a small `useFlowLedger` test) that an offline preview still gets the category of the user's last expense at that merchant; behaviour unchanged.
  2. `FlowLedger.tsx` `DayGroup` `<section>`: add `[content-visibility:auto] [contain-intrinsic-size:auto_240px]` so off-screen day groups skip layout and paint. No structural change, default look unchanged (allowed token/perf edit; note it to the owner). Check swipe-to-delete and the sticky strip on iOS and Android before shipping.
  3. Stop here. Real virtualisation or paging by rows changes the list's structure and is not worth it until a real account shows more than about 300 rows in one cycle.
  4. No SQL migration.
- **Effort / risk:** S (steps 1-2) · step 2 could clip a swiped row's action buttons or change scroll anchoring; verify on device. Virtualisation would be L and is deliberately not planned.
- **Owner question:** Do you want row virtualisation planned now (L, touches the Flow ledger structure), or only the two small changes above with a revisit when a tester's month exceeds about 300 rows? Recommended: the small changes only.
- **Related:** QA-85 (the seven whole-array subscribers), QA-81 (same large-store scale).

### QA-79 · PERF-003 · /api/gold requested 2-3 times per load
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `fetchGoldPrice` has no in-flight guard (`src/lib/market/marketData.ts:58-82`), unlike `fetchExchangeRates` (`:22-29`). On a warm load with gold older than 15 minutes two callers fire in the same tick: `ensureMarketDataFresh()` from the sync mount (`src/components/sync/SupabaseFinanceSync.ts:215`) and the mount effect of `useGoldPrice` (`src/hooks/useGoldPrice.ts:14-21`, mounted by `MarketRatesSync` at `src/components/layout/AppShell.tsx:215-219`). A failed or "unavailable" response never stamps `lastGoldFetch` (`src/lib/store/useFinanceStore.ts:2030-2035`), so any later caller (shell remount after the splash, reconnect at `SupabaseFinanceSync.ts:508`) asks again, which explains the third call.
- **Fix plan:**
  1. `src/lib/market/marketData.ts`: mirror the rates guard. Rename the body to `requestGoldPrice` and export `fetchGoldPrice` as `goldInFlight ??= requestGoldPrice().finally(() => { goldInFlight = null })`.
  2. No SQL migration.
  3. Test next to the existing market-data tests: two `fetchGoldPrice()` calls in the same tick produce one `/api/gold` fetch; a call after the first settles produces a second. Fails before (two fetches), passes after.
- **Effort / risk:** S · a base-currency switch during an in-flight fetch reuses that fetch; it converts with the store's currency at resolve time (`goldUsdToBase` reads the store then), so the result is still denominated correctly.

### QA-80 · PERF-004 · Every route ships ~63 chunks / 1.3 MB
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high (mechanism), not re-measured
- **Evidence:** One root layout serves every `(app)` route and statically imports `AuthProvider` and `AppShell` (`src/app/(app)/layout.tsx:6-7,156-159`). `AppShell` statically imports `ModalProvider` (three sheets, the Buddgy orb, the FAB) and `AppViewRouter`, which by design statically imports all 17 shell views so in-app navigation is a synchronous swap (`src/components/layout/AppViewRouter.tsx:6-27`, comment at `:6-9`). `/legal`, `/offline`, `/install` and `/reset-password` sit under the same layout and only switch to a bare frame at runtime (`src/components/layout/AppShell.tsx:291,315-322`), so they download the whole app. This is the cost of the documented in-memory view shell, not an accident. Native apps load the bundle from disk, so only web visitors pay; the marketing site already has its own light layouts (`src/app/(site-en)`, `src/app/(site-ar)`).
- **Fix plan:**
  1. Move `legal/`, `offline/` and `install/` out of `(app)` into a new route group with its own minimal root layout (fonts, `globals.css`, `THEME_INIT_SCRIPT`, `LocaleProvider`, `PlatformBodyClass`; no `AuthProvider`, `AppShell` or `ModalProvider`). These routes are only ever reached by a full document load (`AppViewRouter.tsx:57-60`) and the legal pages use no auth or finance store, so nothing in-app depends on sharing the layout. Keep the `/terms` and `/privacy` redirects pointing at the same URLs.
  2. Remove `'/legal'`, `'/offline'`, `'/install'` from `BARE_ROUTES` (`AppShell.tsx:291`) and `/legal` from `isBypassRoute` (`src/components/auth/AuthProvider.tsx:587-590`) once they no longer render inside the shell.
  3. Leave sign-in alone: the landing gate renders inside the shell on purpose and the downloaded chunks are what makes the app instant after sign-in.
  4. No SQL migration. Check: `next build` route table shows the legal routes' First Load JS drop; `src/app/(app)/legal/legalArabic.test.tsx` still passes after the move; the Capacitor static export still emits the legal pages (`npm run cap:build`, no native build needed).
- **Effort / risk:** M · the service-worker precache list, the CSP nonce in `src/proxy.ts`, the locale cookie and the in-app links from Settings to the legal pages all need a pass; a native in-app link to a legal page becomes a document load into a different layout (it already is a document load today).
- **Owner question:** Is a lighter legal/offline/install page worth a half-day now, or should this wait until web traffic matters? Options: (a) do the route-group move now, (b) defer and keep the ticket as a launch-polish item. Recommended: (b); it changes nothing for native users or signed-in web users.
- **Related:** QA-83 (the same shell-on-public-pages cause; the move in step 1 also removes its `/api/ai` call on legal pages).

### QA-81 · PERF-005 · Whole-store localStorage persistence hits quota at ~12,000 expenses
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 (theoretical at current scale) · confidence high on the mechanism, med on the side effect below
- **Evidence:** The finance store persists everything except two flags into one localStorage key (`src/lib/store/useFinanceStore.ts:79,2403-2410`) and the sync keeps a per-row hash in `buddget:flushed:<uid>` (`src/components/sync/flushedFingerprint.ts:87-91`), so the audit's 12,000-expense extrapolation is plausible. The "20,000" comment in `src/lib/store/debouncedPersistStorage.ts:5` is about stringify stall time, not a quota assumption. Hitting the quota is handled: the refused value stays in memory, a toast warns once, the sync cursor is cleared and unsent edits are pushed (`src/lib/store/safeLocalStorage.ts:52-60`, `src/components/sync/SupabaseFinanceSync.ts:363-366,596`, `src/components/layout/StorageQuotaToast.tsx`). So the server copy stays complete; what is lost is the offline cache of the newest edits. One gap I found while reading: `saveFingerprint` still writes while the store write is being refused (no `hasUnpersistedWrites()` check). The fingerprint is much smaller, so near the limit it can succeed when the store cannot. On the next cold start the cache is then older than the fingerprint, and `baselineFromFingerprint` treats rows the fingerprint knows but the cache lacks as "deleted offline" (`flushedFingerprint.ts:65-79`), so the first flush would tombstone on the server the few rows added right at the limit. Not run, reasoned from code; only reachable at the quota.
- **Fix plan:**
  1. `src/components/sync/flushedFingerprint.ts` `saveFingerprint`: when `hasUnpersistedWrites()` is true, remove the stored fingerprint and return, so the next boot trusts the cache (the existing fallback) and the full pull brings the rest back. Test in `src/components/sync/flushedFingerprint.test.ts`: with the store write refused, a row added afterwards is not in the next boot's `deletes`. Fails before, passes after.
  2. Fix the misleading comment in `debouncedPersistStorage.ts` only if touched; no other code change now.
  3. No SQL migration. No storage rewrite planned.
- **Effort / risk:** S for step 1 · dropping the fingerprint at the quota means an offline edit made in that state is only re-sent by the normal flush, which is what already happens for a first run.
- **Owner question:** Moving the cache to IndexedDB (or keeping only recent months on the device) is the real fix and is a day-plus change to boot and sync. Decide now or at a trigger? Recommended: defer, and revisit when any account passes about 5,000 expenses (roughly 2 MB of the 5 MB limit); an SMS-tracking user at 5 a day gets there in about three years.
- **Related:** QA-78, QA-85 (same large-store scale).

### QA-82 · PERF-006 · Reports ~190 commits per load
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence med (mechanism read, count not re-measured)
- **Evidence:** The two Reports charts use Recharts 3.8 with default animation: `<Pie>` (`src/components/reports/CategoryPieChart.tsx:54-66`) and three `<Bar>` (`src/components/reports/MonthlyChart.tsx:74-76`) set no `isAnimationActive`, and nothing in the app passes reduced-motion to Recharts (`MotionConfigRoot` covers Framer Motion only). Each animating series updates state per frame for about 1.5 s, which accounts for the commit count and for the tail after 5 s on a throttled CPU. The ticket's second suggestion is already done: `monthlyData` and `categoryData` are memoised (`src/hooks/useReportsPage.ts:96,107`). The commits are confined to the chart subtrees, so this is wasted work on a slow phone, not a visible bug.
- **Fix plan:**
  1. `CategoryPieChart.tsx` and `MonthlyChart.tsx`: read `useReducedMotion()` from `framer-motion` (already a dependency) and pass `isAnimationActive={!reduced}` to `<Pie>` and each `<Bar>`. If the owner prefers static charts for everyone, pass `isAnimationActive={false}` instead and skip the hook.
  2. No SQL migration.
  3. Test: render each chart with reduced motion mocked on and assert the series receives `isAnimationActive={false}` (mock `recharts` to capture props, as chart tests in this repo render without layout). Fails before, passes after.
- **Effort / risk:** S · charts appear without the grow-in animation for affected users; no data or layout change. `src/components/features/admin/ui/Charts.tsx` also uses Recharts but is the admin portal and out of scope.
- **Owner question:** Turn the chart animation off for everyone (removes the cost on every phone) or only when the device asks for reduced motion (keeps the animation, fixes accessibility only)? Recommended: off for everyone on the two Reports charts.

### QA-83 · PERF-007 · Public pages make unrelated API calls
- **Verdict:** CONFIRMED · ticket P3 → my severity P3 · confidence high
- **Evidence:** `PasswordUpdatedCookieSync` is rendered unconditionally by `AuthProvider` and calls `GET /api/auth/password-updated` once per document load on every `(app)` route, signed in or not (`src/components/auth/AuthProvider.tsx:62-86,669`). The cookie is HttpOnly, so the client cannot check it locally; the only flow that sets it ends with `window.location.replace('/')` (`src/app/(app)/reset-password/confirm/page.tsx:127,154`; cookie set at `src/app/api/auth/password/change/route.ts:98`). `GET /api/ai` on legal pages comes from the bare shell still mounting `ModalProvider` (`src/components/layout/AppShell.tsx:320`), whose `AIChatBubble` calls `checkAIStatus()` on mount for any visitor (`src/components/ai/AIChatBubble.tsx:57-59`, `src/lib/ai/gemini.ts:665-680`). Legal is the only public route that renders children while signed out (`AuthProvider.tsx:587-590`), which is why only legal pages show it.
- **Fix plan:**
  1. `reset-password/confirm/page.tsx`: just before `window.location.replace('/')` in the announce branch, set a `sessionStorage` hint (for example `bdg-pw-updated=1`). `PasswordUpdatedCookieSync`: only call the endpoint when that hint is present, and remove it. The server cookie stays the authority for showing the message, so a forged hint only costs one request that answers `pending: false`.
  2. `AIChatBubble.tsx`: skip `checkAIStatus()` when there is no signed-in user (`useOptionalAuth()`; rerun the effect when the user id appears). The orb is useless signed out because opening it goes through `requireAuth`.
  3. No SQL migration.
  4. Tests: (a) `PasswordUpdatedCookieSync` makes no request without the hint and one request with it, and still opens the sign-in modal when the server answers `pending: true`; (b) `AIChatBubble` rendered with no user makes no `/api/ai` request, and makes one once a user is present. Both fail before, pass after.
- **Effort / risk:** S · if the reset is finished in a different tab from the one that lands on `/`, the success message is not shown (the password is still changed and the cookie expires in 60 s). Native: `sessionStorage` survives the `location.replace` in the WebView, same as web.
- **Related:** QA-80 (moving legal pages out of the shell removes the `/api/ai` call there without step 2; step 2 is still worth doing for `/reset-password`).

### QA-84 · PERF-009 · One /expenses cold load produced 2,145 React commits (watch item)
- **Verdict:** UNSURE · ticket P3 → my severity P3 (watch) · confidence low
- **Evidence:** Seen once, not reproduced in six repeats, and I found no loop in code. The paths that run only on a first signed-in load were read end to end: the stamping subscriber re-enters once and then stops, because a stamped row's `updatedAt` differs from the previous state (`src/lib/supabase/remote/stampEdits.ts:27-30`, subscribed at `src/components/sync/SupabaseFinanceSync.ts:410-413`); the flush subscriber never sets state (`:414-443`); the periodic hooks mounted by the shell set state at most once per data-ready change (`src/hooks/useCycleAwareMonth.ts`, `src/hooks/useLogDueSubscriptions.ts`); adopted-charge deletes run in one synchronous batch (`SupabaseFinanceSync.ts:643-647`). The one first-load-only anomaly that does exist is the duplicate full pull in QA-22: two merges of 23 slices each land during first paint. That explains extra work and a late FCP, but a handful of commits, not thousands. `/expenses` is the Flow view (`src/components/layout/AppViewRouter.tsx:32`), which has no chart or per-frame state. Cannot be settled without a runtime profile.
- **Fix plan:**
  1. No code change for this ticket. Ship the QA-22 fix first.
  2. Then repeat the audit's exact first-sign-in run (fresh profile, password sign-in, 3,000-expense account, mobile throttle) three times with the React Profiler recording. If any run exceeds about 200 commits, record which component commits and reopen with that; otherwise close as not reproducible.
  3. No SQL migration.
- **Effort / risk:** S (measurement only) · none.
- **Owner question:** Close this as not reproducible if three profiled first-sign-in runs after the QA-22 fix stay under about 200 commits? Options: (a) yes, close on that evidence, (b) keep open as a standing watch item. Recommended: (a).
- **Related:** QA-22.

### QA-85 · PERF-010 · (Info) Zustand fan-out; 7 components subscribe to all expenses
- **Verdict:** NOT-A-BUG · ticket P3 → no severity (info) · confidence high
- **Evidence:** The ticket itself files this as information. Checked at HEAD: zero bare `useFinanceStore()` calls in `src/`; the whole-array subscribers are where the ticket says (`src/components/features/accounts/AccountDetailSheet.tsx:50`, `src/components/modals/EditExpenseSheet.tsx:9`, `src/components/features/flow/RefundPickSheet.tsx:21`, `src/hooks/useDetectedAccounts.ts:19`, `src/hooks/useDebtTabData.ts:159`, `src/components/features/budget/SegmentExtra.tsx:22`). Each derives its output from the list, so re-rendering when an expense changes is correct, and Zustand only notifies when the array reference changes (an actual add, edit, delete or sync merge), not on rate or gold ticks. Nothing to fix. Side note, outside this ticket and not a defect at current scale: several always-mounted components call `useSettingsStore()` with no selector (`src/components/modals/ModalProvider.tsx:71`, `src/components/layout/BottomNav.tsx:24`, `src/components/modals/QuickAddFAB.tsx:33`) and so re-render on every settings-store change; narrow them only if QA-78 work measures a cost.
- **Related:** QA-78.



## 7. Decisions, 2026-11-19

These override sections 2 and 3 where they differ.

### 7.1 Owner decisions

| Ticket | Decision |
|---|---|
| QA-57 | Postpone the Linear integration. Remove the feedback-to-Linear outbox from the live path (stop enqueueing, stop the drain job, drop it from the health check, clear the stuck row). Feedback stays in the admin portal only. |
| QA-99 | Keep the email-first signal; add a per-IP daily cap and fail closed. |
| QA-117 | Zakat question shows only when the answer changes the result, and it goes through the existing banner/prompt-stack system. Tablet 768-1023 px: cap and centre the column. |
| QA-74 | iPad is supported. Keep all orientations; do a landscape pass in the simulator. |
| QA-13, QA-122 | A pocket created from an account is an earmark inside that account. Backfill existing linked pockets. |
| QA-28, QA-29 | Disregarded for now (Supabase plan tier). |
| QA-37 | USD to EGP transfers between own HSBC accounts arrive as two SMS. Pair them by opposite direction, different currency, amounts within a margin of the rate, close in time. Real samples: `docs/qa/SMS_REAL_SAMPLES.md`. |
| QA-32, QA-103 | Search of all 1,028 tracked SMS (June to November 2026). QA-103: three real HSBC ATM withdrawal SMS found; the disabled pattern does not match their wording, so write a new pattern from the samples. QA-32: no two-transaction SMS exists; close as backlog. |
| QA-10 | See 7.2. |

### 7.2 QA-10: sign-up codes and the email engine

Full findings and five ready-to-paste templates: `docs/qa/QA10_AUTH_EMAIL_FINDINGS.md`.

- We do have our own branded engine (our templates, sent through Resend). For mail that Supabase Auth itself triggers (sign-up code, sign-in code, password reset), our engine only takes over when Supabase's **Send Email hook** is enabled. Live logs show the hook is **off** on the Frankfurt project, so Supabase has been sending its own default, unformatted, link-only emails.
- **Admin portal, 8-digit code:** Supabase generates that code and we email it, so its length follows the dashboard setting. Setting the length to 6 fixes it. Codes already sent stay 8 digits; request a new one.
- **Sign-up, no code:** not fixed by the length change. Testers received Supabase's default template, which has a link and no code. Turning the hook on fixes it.
- **Owner action (Supabase dashboard, Frankfurt project, Auth):** turn on the Send Email hook with URL `<app origin>/api/auth/email-hook` and the existing `SEND_EMAIL_HOOK_SECRET` from Vercel (a new secret would break the Singapore project that older native builds still use); OTP expiry 600 s; keep Confirm email on; check Site URL and redirect URLs; check email rate limits.
- With the hook on, no Supabase template is used. The templates in the findings file (Confirm signup, Magic Link, Reset Password; optional Reauthentication, Change Email Address) are only a stopgap while the hook is off, and are English only.
- Code change: one `EMAIL_OTP_LENGTH` constant drives the eight places that hard-code 6; the hook route logs its failures.
- Two side findings, not investigated further: 874 welcome emails failed with "RESEND_API_KEY is not set", logged with no user, from something writing to the production database; and Frankfurt logs "unrecognized JWT kid" errors on sign-in checks (probably older native builds presenting Singapore tokens).

### 7.3 Council and founder board votes

Council: Skeptic (S), Pragmatist (Pr), Critic (C). Board: Offers (O), Monopoly (M), Product (Pd). Each voted from a neutral brief that did not contain the earlier recommendations. The board voted on product items only. "Final" is the reviewed outcome; where it departs from the majority the reason is given.

| Ticket | Question | Votes | Final |
|---|---|---|---|
| QA-90, QA-93 | Internal moves in Flow | 6 of 6: hide by default behind a "Not counted" chip | Hide by default; the chip shows a count so nothing looks lost. Pocket and goal funding stay out of Flow. |
| QA-111 | Buddgy figure covers amounts | 6 of 6: default left and add scroll clearance | Both. |
| QA-76 | PWA fullscreen | 6 of 6: status bar visible | Standalone. |
| QA-12 | "Saved right now" with tracked accounts | Council 3: ask, create nothing. Board: 2 read balances, 1 pick an account | **Skip the question when accounts are tracked and create nothing.** Asking and discarding the answer was the main objection; skipping is as small and satisfies both sides. |
| QA-11 | Old rows without a time | 6 of 6: fix forward only | Fix forward. |
| QA-14 | AI-read money-in | 5: confirm only when the check fails. Critic: always | Confirm when the check fails **or the sender is new for that user**. The check alone passes a well-formed forgery, which three voices pointed out. |
| QA-41 | Delete-undo rule | 6 of 6: accept the new rule | Accept; show a message when an undo is refused. |
| QA-47 | 10 purchases a day late | 5: repair. Critic: leave | One-off repair. |
| QA-49 | Hand-marked payday vs salary SMS | 6 of 6: replace after the prompt | After the prompt. |
| QA-23 | Family debt with no monthly amount | 6 of 6: balance ÷ 12 | Balance ÷ 12. |
| QA-24 | Reports "Money in" | 5: show expected and received. Pragmatist: label only | Show both. Larger than the label fix (about half a day). |
| QA-65 | Sign-out | 6 of 6: send, then wipe, 3 s timeout | Timeout; if edits are still unsent at the timeout, ask before wiping. |
| QA-33 | Identical SMS within 3 minutes | 6 of 6: keep book and flag | Keep. |
| QA-34 | Two-phone own transfer | 4: remember "both mine". Critic: keep asking. Monopoly: also shared reference | Remember the answer per account pair. |
| QA-36 | Masking before the AI | 6 of 6: mask identifiers, keep balances | As voted. |
| QA-53 | Suspended account and support | 6 of 6: support allowed, block feedback and votes | As voted. |
| QA-66 | App links | 6 of 6: invite links only | Invite links only. |
| QA-71 | Android SMS gate | 5: keep gate, fix wording. Monopoly: tighten | Keep the gate, correct the privacy wording. |
| QA-77 | PWA orientation | 6 of 6: allow rotation | Allow rotation, after a landscape pass. |
| QA-82 | Reports chart animation | 4: off under reduced motion only. 2: off for all | Reduced motion only. This leaves the extra renders; the performance half is closed as accepted. |
| QA-86 | "Saves X% of income" | 6 of 6: plan-based, reworded, hidden with no budget | As voted. |
| QA-89 | Preselected category | 4: nothing preselected. 2: most used | Nothing preselected, and saving requires a category. |
| QA-91 | Rounding | 6 of 6: cells show cents when not whole | As voted; check cell width. |
| QA-94 | Debt-free date | 6 of 6: keep both, label distinctly | As voted. |
| QA-97 | /buddgy link | 5: close. Monopoly: build | Close. |
| QA-112 | Rename two labels | 6 of 6: yes | Rename. |
| QA-116 | Helper line on Money in | 6 of 6: add | Add. |
| QA-27 | Arabic layout | **3 to 3 tie**: keep for launch vs full mirror before launch | **Keep for launch**; the mirror is a large project with its own risk. Logged as a post-launch project. This is the one tie, so it is yours to overrule. |
| QA-106 | Concurrent edits | 5: keep and notify the replaced device. Pragmatist: keep | Keep "newest edit wins" and add a notice. Scheduled last in the sync work. |
| QA-78, 80, 81 | Scale-only performance | 6 of 6: defer with triggers | Defer. |
| QA-59 | Email in trial_claims | 2: keyed hash. 1: plain SHA-256 | Keyed hash; a plain hash of an email is guessable. |
| QA-61 | Migration ledger | 2: document. 1: backfill | Document that the repo folder is the record. |
| QA-62 | Savings dates | 3 of 3: 2000-2100 check only | As voted. |
| QA-56 | Public deep health | 3 of 3: reduce the public answer | Public answer is ok/degraded; detail behind the cron secret. This reverses the earlier "leave it". |
| QA-101 | net.* functions | 3 of 3: try the revoke, accept if it no-ops | As voted. |
| QA-102 | Ingest token expiry | 3 of 3: keep non-expiring | Keep; fix only the cookie-authenticated GET. |
| QA-108 | Unique index backstop | 2: add. 1: no | **No index.** The deterministic id is the primary key, so a second insert conflicts already; the index would need a duplicate scan and conflict handling for no added protection. |
| QA-120 | Earlier SMS for a new account | 3 of 3: one-off repair | One-off repair of about 15 rows. |
| QA-84 | 2,145 renders | 3 of 3: fix the double pull, re-profile, close if low | As voted. |
| Not-a-bug closes | Close eight | 3 of 3: device-check the two visual ones first | Close QA-63, 68, 70, 73, 75, 85 now. QA-44 and QA-96 close after a device look. |

### 7.4 Sessions

Five sessions, each ending with `npm run verify`, a diff audit, and a push to dev and main. No native build is started by any of them.

| # | Session | Tickets | Model | When |
|---|---|---|---|---|
| S1 | Money and sync core | QA-10 (code), 15, 16, 50, 40, 107, 11, 118, 13, 122, 12, 119, 18, 26, 19, 20, 65, 22, 42, 41, 43, 106 | Fable | Wave 1 |
| S2 | SMS pipeline | QA-14, 39, 36, 38, 48, 37, 103, 47, 49, 31, 34, 35, 104, 105, 120 | Opus | Wave 1 |
| S3 | Database, API, security | QA-17, 60, 62, 59, 30, 98, 101, 51, 55, 52, 53, 54, 56, 57, 58, 99, 100, 102, 61 | Opus | Wave 1 |
| S4 | Web UI and functional | QA-23, 24, 25, 64, 86, 87, 88, 89, 91, 121, 92, 94, 95, 123, 27, 45, 46, 109, 110, 111, 112, 113, 114, 115, 116, 117, 108, 79, 82, 83, 90, 93 | Sonnet | Wave 2, after S1 lands |
| S5 | Native and PWA | QA-21, 72, 67, 69, 66, 71, 74, 76, 77, the advertising-ID finding | Opus | Wave 2 |

Wave 1 sessions touch separate areas (sync and store; `src/lib/sms`; migrations and API routes). S4 waits for S1 because both touch the pocket form and the payment-method pickers.
