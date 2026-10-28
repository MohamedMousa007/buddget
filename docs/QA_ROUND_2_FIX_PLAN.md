# QA Round 2 — Fix plan (v2, reviewed)

**Status: final plan, execution starting at B0.** Reviewed by three independent audits (`docs/qa-round-2/PLAN_REVIEW_A.md` ordering/migrations, `PLAN_REVIEW_B.md` secondary effects of the 25 riskiest fixes against the live DB, `PLAN_REVIEW_C.md` UX/design). Their required changes are applied below.

Sources: findings (`docs/qa-round-2/*.md`, 395), owner decisions (`QA_ROUND_2_DECISIONS.md`, **binding; where LEDGER notes still say "not in DECISIONS" or contradict it, DECISIONS wins**), per-finding assignment (`docs/qa-round-2/LEDGER.md`, 405 IDs), files/migrations/conflicts (`docs/qa-round-2/FILE_OWNERSHIP.md`).
Dispositions: FIX 302, FIX-WITH-DECISION 55, DEFER 23, DUPLICATE 25 (every DEFER has a reason).

## Execution protocol (every batch)

1. Read the batch rows (LEDGER) + files (FILE_OWNERSHIP); split into parallel packages with **disjoint files**. Hot shared files (`useFinanceStore.ts`, `calculations.ts`, `sync.ts`, `en.ts`/`ar.ts`, `ModalShell`, `database.types.ts`) are edited by one package at a time, by function.
2. Failing test first for logic fixes (TZ=Africa/Cairo); render/a11y tests for UI fixes where practical.
3. **Database:** migration file -> audit SELECTs (counts, affected rows; assert expected counts inside the migration) -> backup into a **non-exposed schema** (never a public table: default grants expose public tables to the anon key) -> apply with `execute_sql` -> regenerate `database.types.ts` from the live DB. Every rewritten function starts from the **live definition**, not the repo file.
4. **Deploy order:** *additive* migrations (new columns/tables/functions) apply **before** the code that writes them; *restrictive* ones (policies, constraints, grants, revokes, drops) apply **after** the code is deployed and verified, and must tolerate installed native builds that never update. Never change an RPC signature in place: keep the old signature, add a new function name.
5. Gate: `npm run lint` (0 errors), `npx tsc --noEmit`, `npm run test`, `npm run build` (dummy Supabase env).
6. Adversarial read-only review of the batch diff; fix findings before commit.
7. Commit per batch, push `dev` + `main`, confirm `origin/main` hash and the Vercel production deploy before any dependent DB step.
8. Update LEDGER status per ID and the team artifact.
9. Stop and ask if a fix would exceed its decision (new UI not covered, money-table repair, destructive step, sync-core redesign).
10. No native build/upload unless the owner asks.

## Batches (order is binding)

| # | Theme | Rows | Migrations | Headline items |
|---|---|---|---|---|
| **B0** | Test/CI foundation (new, short) | ~6 | none | TZ-pinned tests (Z7), run pg tests in CI (Z2), PR-time CI (Z11), skip live eval in `npm test` (Z10), `engines`, so every later batch has a reliable gate |
| B1 | Money engine + data repair | 37 | 0197-0200 | W1, W2, D1/D2, W5-W9, L1/L3, R1/R2 (see corrections below) |
| B2 | Money flows UI | 37 | none | pay-debt currency picker (`AmountCurrencyRow` + `includeGold`), delete+Undo (with the toast fixes U31/U39 moved here), zakat Done + "Mark zakat as paid", one shared "From account" wrapper in `MoneySheetParts` used by every deposit sheet, amount parser/formatters, receipt sheet wiring, card validation, Buddgy add guardrails |
| B3 | Privacy + security DB/auth | 43 | 0201-0208 | policies/grants, erasure FKs, merchant_categories, password change, 2FA gate behind a flag, admin RBAC, backup/prefs, constraints |
| B4 | SMS pipeline + learning funnel + lifecycle | 47 | 0209-0211 (split) | LF1-LF7, N-series, PR1 Pattern review page, retention lifecycle (enable last) |
| B5 | Budget/reports/cycle consistency | 31 | 0212 | single Left to spend, Reports, cycle nav, hero grow, pace |
| B6 | Native + platform + notifications | 33 | 0213-0214 + scheduler | **Z1 native/dependency bumps first**, then V-series, iOS 16.4 (edit the 4 pbxproj entries only; `Package.swift` is regenerated), build-number check, pg_net scheduler, consent screen |
| B7 | Dependencies/CI remainder | ~15 | none | non-native bumps, env validation, audit step |
| B8 | Performance | 18 | 0215-0216 | stats once per tree, persist, selectors, realtime publication; offline-critical sheets stay static; **F3 CSP nonce deferred** until a browser CSP test exists |
| B9 | i18n + glossary + week start + Arabic | 21 | 0217 | **glossary sweep first**, then Arabic strings (ship, owner reviews after), plurals, date locale, Saturday-first setting, LTR un-mirror |
| B10a | Accessibility + tokens | ~24 | none | focus ring (full-opacity classes in 30 files), hit areas in Button/IconButton, chip tokens, sheet names, error roles, reduced motion |
| B10b | Component merges | 10 | none | see "Component merges (as built)" |
| B10c | Dead code | 10 | 0218 | ~1,450 lines |
| B11 | Remaining P2/P3 sweep | 47 | 0219-0220 | per-area leftovers |
| B12 | Live UI verification + docs + backlog | 24 | none | browser regression (hit-test based), DEFER register, store checklist, round 3 |

## Review outcomes applied (what changed in the plan)

**Live data corrected the premises (repairs asserted by count):** only 4 unlinked debt-payment expenses (not 21) and none match a payment by debt+amount; no income events hidden by deleted sources; 1 gold pocket (1 g deposit) and no gold debts/income, so the W1/D2/L1 *data* repairs are empty. Fix the code paths; repair migrations assert their expected counts and do nothing otherwise. Old app builds keep creating unlinked pairs after the fix, so the server also links on write.

**Retention (highest risk, re-sequenced):** `harvested_at` is set on 863 of 863 rows, so it does not mean "learned from"; 682 rows are older than 30 days; 455 of 518 corpus shapes have `seen_count < 3`. Therefore: (a) 0209a schema only (nullable `raw_body`, new `masked_version`/`learned_at` stamps); (b) LF3 backfill uses the new stamp and re-harvests with the improved masker; (c) LF6 leak scanner passes; (d) only then 0209b rewrites `sms_retention()` and sets `sms_retention_enabled=true`; corpus drop threshold 180 days. 14 readers of `raw_body` (SQL pairing, template re-test, undo, confirm, corrections, admin) get explicit NULL handling first. LF1 hashes the **raw** message so retries from old builds do not duplicate rows; the normaliser never touches Arabic letters (27 of 53 live templates contain them). No bidi marks exist in stored bodies today, so LF1/N5 evidence is re-measured before and after.

**Scheduler:** pg_net is not installed. Migration enables `pg_net`, stores the cron secret in **vault** (not in `cron.job`), uses a timeout longer than the route runtime, one shared notification cursor for the Vercel and pg_cron runs (so no double send), a cap on the first run so a backlog is not pushed to everyone, and a Cairo fallback for the 44 of 45 users with no timezone yet. `CRON_SECRET` on Vercel must be verified by the owner first. LF3's daily harvest call depends on this, so the scheduler lands before it inside B4/B6 ordering.

**2FA gate (C1):** separate flagged function with an allow-list (not inside the fail-open `app_client_gate`); only 1 of 45 users has 2FA and that account also has a biometric binding, so **biometric sign-in counts as the second factor** (device-bound secret + biometric prompt); existing sessions are grandfathered; rollout flag off -> report-only -> enforce.

**Sender checks:** `sender` is empty on 863 of 863 rows, so "strict for credits" cannot key on it today. Rule: when a sender is present, credits must match the bank's known senders or go to confirm; when empty, log-only (no flips, 160 credit rows unchanged). Sender capture on Android/iOS is fixed so it becomes available.

**Constraints (Q8/Q9):** NOT VALID does not protect old rows from UPDATE; add `amount > 0` only on `expenses`, `income_events`, `debt_payments` (0 live violators; not `budget_categories`, which has 4 zero rows); no date window constraint (3 live out-of-window rows); FK additions need sync tier reordering (`income_events` after sources/debts/savings, `profiles` before plans) and `ON DELETE SET NULL` so housekeeping hard-deletes do not roll back.

**Anonymous cleanup (0207):** adds a data-activity guard, dry-run list shown to the owner, weekly schedule (8 anonymous users all look idle; one has expenses).

**RPC hardening (0199):** keep old function signatures; new behaviour in new function names; decide which RPC D8 keeps before hardening so D22 does not drop it later. Anon keeps SELECT on `asset_prices` and `merchant_categories`. `merchant_categories` has no contributor data, so corroboration applies to new edits only.

**Money specifics (B1):** W1: a null XAU conversion must not turn into grams-as-EGP at ~6 summing sites; the persisted rates cache is re-keyed (old ounce keys dropped). W2: stamp the account leg on one side only (never both the withdrawal and its income event), freeze the account-side amount at write time, no leg for the 18 of 23 non-cash savings transactions, one shared definition of "primary account" for client and server. W7: **spike first** (design note + owner check-in) because the client never calls the savings RPCs and no trigger derives the balance; offline deposits must keep working; no sync-core change without sign-off.

**UI (as built, per review C):**
- *Sheet header:* `V3SheetHeader` is the single component; one additive `compact` option reproduces the old look so step 1 changes nothing; step 2 (title 16 -> 22px, h3 -> h2, tinted close, translated "Close" label, no double padding) is a separate commit the owner can stop before.
- *EmptyState:* one new `illustration` prop only (the existing `action` prop stays the CTA); used by the new 404/offline pages; the six bespoke empties are **not** migrated (they are a goals form, tile grid, chat start, checklist, row list and would become live regions). This narrows the owner's choice; flagged for confirmation.
- *Focus ring:* full-opacity ring classes in ~30 files (not just the token), clipped rings inside `overflow-hidden` fixed.
- *Hit areas:* inside `Button`/`IconButton` (xs/sm stay admin-only per DESIGN_SYSTEM), exceptions for carousel dots, month arrows, wealth badges; B12 verifies with hit-testing, not element rectangles.
- *Toast/Undo:* above sheets (z-index), more than one toast, Undo target 44px, pause on hover/focus, translated label; ships in B2 with the delete flows.
- *Arabic:* T11 (bidi plaintext) dropped to avoid re-right-aligning rows X14 un-mirrors; glossary term for the tab uses the real tab name (Wealth) — glossary goes to the owner before the sweep.
- *Pay-debt:* `AmountCurrencyRow` + additive `includeGold` (already supports XAU). *Zakat:* "Done" + confirmed "Mark zakat as paid". *Week start:* settings registry (`quick` group); because 44 of 45 users have no timezone, existing users get Sunday->Saturday default via locale until a device reports a zone. *Push pre-prompt:* reuse `StepAutomate` Allow/Later and `pushLaterAt`; stop `NativeBootstrap` requesting at boot. *404:* a real `not-found` view inside the app shell with `AppLink` back to Flow. *LTR un-mirror:* the 6 mirroring places (chevron flips in SettingsRow, ProfileBanner, SettingsSearch, sub-page back arrow; `text-end` on label blocks).

**Contradictions resolved in DECISIONS' favour:** Arabic ships then owner reviews; no "Export my data" (C12 removed); memory proposals default OFF for new users (I20); strict sender check for credits only; week start default not timezone-only.

**Other corrections:** WidgetSync work (R20) dropped because V15 unmounts it; `lib/budget/{lineEdit,monthClose}`, `recurringDebtDueHandlers`, `lib/savings/*` (vs B2 zakat) and R11's Reports/flow consumers added to the overlap list (sequence B1 before B5, B2 zakat before savings sweep); F10 gate rewrite keeps the force-update check and must not skip when no header (old native builds), and any 2FA check stays out of the fail-open hook; F6 persist change ships with a persisted-shape migration and a kill-during-write test; password change deletes biometric/trusted-device rows **before** revoking sessions, biometric sign-in 404 is treated as "binding revoked", re-auth never creates a new session.

## Owner-side steps (cannot be done in code)

Check `CRON_SECRET` on Vercel and cron history; restrict the Firebase key; Play Console SMS declaration + Data Safety form + App Store privacy label; leaked-password protection and Auth settings (anonymous sign-ins, OTP/JWT TTL, PITR); confirm the last TestFlight build number before touching `Info.plist` (it reads 6 while releases 127-129 shipped); review the glossary (before B9) and the Arabic list (after); approve the narrowed EmptyState scope and U4 step 2; schedule the monthly Claude review after PR1; any native rebuild/upload only when requested.

## Risk register (top)

C1 2FA lockout (flag + allow-list + biometric = second factor); retention purge irreversible (enable last, behind flag and new stamp); W7 sync core (spike first); Q8 un-updatable rows (amount>0 only, three tables); F3 CSP blank page (deferred); F10 force-update bypass (kept); Z1 native bumps (rebuild only on request); pg_net secret handling (vault); anon cleanup deleting a real guest (activity guard + dry-run).
