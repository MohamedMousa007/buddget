# Accounts Refactor — Master Plan (final)

Status: planning only, nothing applied. Designs: https://claude.ai/artifact/NZTVvuJh5haLJtE8yskuKV (9 interactive boards, unrendered mockups).

## 1. Product model

| Concept | What it is | Wealth? |
|---|---|---|
| **Account** | A real money container with a tracked balance: bank account, e-wallet (Vodafone Cash), Cash. Stored as a `payment_methods` row with `kind='account'`. | No. Own tab. |
| **Card / payment method** | Debit, credit, prepaid, BNPL that spends *through* an account. `parent_id` points to the account. Prepaid/Meeza/wallet cards may be standalone. | No. |
| **Pocket** | Money set aside (`savings_accounts`). Piggy-bank semantics, never a spending balance. | Yes (pockets + investments only). |

Rules:
- Spending with a debit card lowers its parent account. Credit-card spend raises "Credit owed"; paying it off lowers the account.
- Cash is a real account row (replaces the earlier "pool").
- Pockets default to **held-in** an account (earmark: account balance unchanged, "free" = balance − held). A standalone pocket is a real transfer out.
- Moving money in-app is limited to **Cash out** (account → Cash) and **Set aside** (account → pocket). Account-to-account is detected from SMS only.
- Net worth "now counts your accounts" is forced in the backend (derived accounts basis); no screen, users are not live.

## 2. Final UX (from the mockups)

| # | Board | Notes |
|---|---|---|
| 1 | Start | Empty state; "Find my accounts" (SMS) or "Add one myself". |
| 2 | Found | Checkbox rows of accounts detected in SMS, each with balance; cards attach automatically. |
| 3 | Accounts (home) | HeroBand + calm account list. Each account row has a **card strip**: up to 2 full card faces (provider, type, last4) side by side + "N cards"; 3+ cards: 2 faces + "+N" chip; no cards: dashed "Add a card". Only exceptions are flagged (amber badge + "1,200 missing · Find it"). |
| 4 | Account | Card-first carousel of this account's cards, balance, free/set-aside bar, Cash out / Set aside / Update, activity filtered by selected card. |
| 5 | Move | Cash out / Set aside segmented; **collapsing "From" picker** (tap to expand the list of accounts with free amounts); NumberPad; live validation vs free. |
| 6 | Fix | Timeline (bank confirmed → entries → dashed missing → bank confirmed) + four tiles: Cash withdrawal (Likely), I spent it, Set aside, Not sure. |
| 7 | Add card | Type tiles + last 4 + name; card spends from the account. |
| 8 | Update | "What does your bank show now?" keypad, live difference vs Buddget. |
| 9 | Add account | Bank, balance today, last 4, "check against my messages". |

Hide balances: off by default, per-surface toggles (hero, lists, notifications, widgets, Buddgy) with presets; Buddgy masks when hiding is on.

## 3. Component plan (CLAUDE.md reuse rule)

Reused as-is: `HeroBand` (3 cells, bar in `bar` slot), `NumberPad` (standalone pad, `showDisplay`), `SegmentedControl`, `SelectableCard` (Fix tiles, card-type tiles, Found checkboxes), `StatusPill` (`tone='amber'`), `ModalShell` (all sheets), `ui/switch`, `TransactionRow` (account activity), `ProviderPickerSheet` + brand catalogue/matcher (bank choice), `PaymentCardCarousel` (account detail carousel), `PageHeader`, `BottomNav`, `EmptyState`, `MoneyDisplay`, `useNumberPad`.

Additive changes to existing components (default look unchanged, with tests):
- `PaymentMethodSetupSheet`: new optional `parentAccountId` prop (Add card board).
- `BottomNav`: new Accounts item (new tab entry, no style change).
- `PaymentCardCarousel`: export the existing face renderer as a named export if needed by the chip (extraction only; no visual change).

**New components (nothing existing fits):**
1. `AccountRow` (approved) — 72px row: squircle brand mark, name, subtitle, balance with dimmed decimals, optional free/alert line; slots for leading checkbox (Found) and trailing chevron. Closest existing is `TransactionRow` (54px icon column, different anatomy), so a variant would reshape it. **Alert:** confirm a new row primitive. Rows reused in 3 places via slots, not variants (avoids the variant limit).
2. `CardFaceChip` (approved; small sibling of the carousel face) — 70×44 card face (network, type, last4) built from `cardGradient`/`TypeGlyph`/`shade` of `PaymentCardCarousel`. **Alert:** the carousel's face is 252×158; a small face needs its own component.
3. `CardStrip` — composes 1–2 `CardFaceChip` + count / "+N" / dashed add.
4. `AccountPicker` — collapsing list ("From"). `SelectField` does not expand inline, so this is a new trigger-row + inline list composed from `AccountRow` slots (approved).
5. `GapTimeline` — vertical dot-and-line timeline (genuinely new primitive).
6. `BrandMark` — squircle monogram with optional alert badge (used by `AccountRow`, picker, Add account).

Design-system doc update: add rows for the six new components and the `AccountRow` slots to `docs/DESIGN_SYSTEM.md`; all colors via tokens (card gradients derive from the method color via `cardGradient`, no hex literals).

## 4. Database (project `ydihurtbcnoflhormgzi`)

Verified live on 2026-10-23: repo files stop at `0149`; live versions are timestamped (latest `20261020140454`), so new files continue as `0150+`. Run `list_migrations`/`list_tables` again right before applying and diff against `database.types.ts`.

Facts the schema must respect (found in the audit, section 12):
- All money columns are `numeric`, not integers. New money columns are `numeric(14,2)`; arithmetic uses a decimal-safe helper (round per currency exponent), never bigint minor units.
- `payment_method_type` already contains `cash, bank_account, wallet, debit_card, credit_card, prepaid_card, bnpl, other`. **No `kind` column.** Account = `cash | bank_account | wallet`; card = the rest. One helper `isAccountType(type)`.
- `income_events.payment_method_id` and `debt_payments.payment_method_id` already exist. `savings_accounts` already has `opening_balance`, `linked_payment_method_id` (used by PocketFormSheet/AddHoldingSheet to tie a pocket to a method, 0 rows linked today) and `savings_transactions` has `balance_after`, `transfer_group_id`, `is_cash_flow`.
- `pm_default_cash` is an in-store sentinel that is never synced (`sync.ts` filters it; mappers emit null). 440 of 587 expenses have `payment_method_id = null`. 10 cash methods exist across 8 users; 2 users have more than one.
- `sync_pull` is generic (`sync_table_delta` + `to_jsonb`), so new columns flow automatically; new tables do not.

0150 `accounts_core` (`payment_methods`)
- `parent_id uuid references payment_methods(id) on delete set null`, `opening_balance numeric(14,2)`, `opening_at timestamptz`, `closed_at timestamptz`. Partial index `where parent_id is not null`. Check constraint: a parent must be an account type, not itself.
- **Null `payment_method_id` is not backfilled.** Resolver rule: null = the user's default Cash account. This avoids rewriting 440+ rows, bumping `updated_at` and flooding delta sync. New rows write an explicit id.
- Cash account: each user's oldest non-deleted `type='cash'` method is "the Cash account" (`is_default` can be a card, so it is not used); created if none exists; the store gets a real UUID row replacing the sentinel via a store migration (like `v17_uuid_remap`), `sync.ts` stops filtering it, and the mappers stop null-emitting it. Extra cash methods stay as separate cash accounts (2 users).
- **Deltas before `opening_at` are ignored.** Without this rule every historical cash expense would drive Cash far below zero.

0151 `ledger_time_and_links`
- `occurred_at timestamptz` on `expenses`, `income_events`, `debt_payments`, `savings_transactions` (nullable; client writes it going forward; reads fall back to the date column at 12:00 local). No mass backfill (cheap, no sync flood); the date-only history is only used for ordering inside a day.
- `expenses.to_payment_method_id` (cash-out/transfer target), `savings_transactions.payment_method_id` (source account), `savings_accounts.held_in_payment_method_id` (earmark; kept separate from `linked_payment_method_id`, whose existing meaning is "this pocket mirrors that method"), `sms_parse_log.payment_method_id`, `sms_parse_log.balance_after numeric(14,2)` (see section 5).
- Partial indexes on every new FK.

0152 `account_balance_reports` (server-written, RLS select-own, no client writes): `id, user_id, payment_method_id, balance numeric(14,2), currency, reported_at, source ('sms'), sms_parse_log_id references sms_parse_log on delete set null`. **Raw reports only; the gap is computed on the client** (it owns the ledger), so the balance logic exists once and cannot drift from a SQL copy. Not in `sync_pull`; the client fetches the latest 2 reports per account through an RLS-invoker RPC `latest_balance_reports()` on Accounts open and after an SMS ack. Index `(user_id, payment_method_id, reported_at desc)`; purge inside the existing `housekeeping` pg_cron job (no new cron).

0152b `account_adjustments` (synced list, standard 4 RLS policies, `updated_at` + `deleted_at` + `a_suppress_noop_updates` triggers, added to `sync_pull`): `id, user_id, payment_method_id, delta numeric(14,2), reason ('manual_update'|'gap'|'opening_correction'), occurred_at, note`. Manual Update and unexplained gaps write a signed adjustment; they never edit `opening_balance` or invent an expense.

0150 also adds `payment_methods.track_sms boolean default true` (the "Check against my messages" toggle).

0153 `privacy_settings`: `user_settings.privacy jsonb`. Note `settingsToRow`/`mappers` must whitelist it.

0154 `adjust_pocket_balance(pocket_id, delta, ...)`: `SECURITY DEFINER`, `set search_path = public`, `revoke ... from public, anon, authenticated`, execute for service role only. It locks the row, updates `current_balance`, writes the `savings_transactions` row with `balance_after`, and is idempotent per `(transfer_group_id)`.

After each: apply, regenerate `database.types.ts`, run `get_advisors` (security + performance), update mappers and the sync diff/emit paths, and add the mapper round-trip tests.

### Balance engine
`balance(account, asOf) = opening_balance + Σ signed deltas where occurred_at >= opening_at` (decimal-safe `numeric` arithmetic):
- + income events landing in the account, + top-ups/cash-out inflows (`to_payment_method_id`)
- − expenses paid via the account or its debit cards, − transfers out, − credit payoff from the account, − debt payments, − standalone-pocket deposits
- Held-in pockets do not change the balance; they reduce *free*.
- Credit-card/BNPL spend is **not** an account delta (non-spend rule, see `project_nonspend_is_not_notowed`); it counts in "Credit owed" until paid.
Pure function in `src/lib/accounts/balance.ts` with an `asOf` param, 100% unit-tested. Derived at read time with a memoized selector; no stored running balance, so nothing can drift.

### Net worth
`netWorth = Σ accounts + pockets + investments − debts − credit owed`. Existing users: "accounts basis" is derived, so the first accounts-aware value is correct without a flag. The month-flow term in the current formula is removed (it double-counts once balances exist). Keep `calculateCashOutflow` semantics for budgeting.

## 5. SMS pipeline and gap detection

- Resolve the account per message: last4 → card → parent; else last4 → account; else "unknown account" prompt on Found. Persist `sms_parse_log.payment_method_id`.
- **The parser does not read balances today** (no balance field in `sms_parse_log`; `learnGates`/`adjudicator` actively guard against the amount group capturing the balance). Balance extraction is therefore a new parser capability, not a hook: a separate `balance` capture added to the curated patterns, the template learner and `aiParserPrompt` (field `balance_after`), validated by a gate that rejects `balance == amount` and values with the wrong currency. Reports are written server-side in `/api/sms/parse` after `directionGuard` and pairing, only when the account resolves. Balance-only messages (currently `is_transaction=false`) become report-only rows (no expense). Gap detection stays disabled for accounts with no balance-bearing SMS, and Update (manual) is the fallback.
- **Gap detection (client-side):** compare the derived balance *at the report instant* (`asOf = reported_at`, ledger rows within a 2-minute clock-skew window included) with the reported balance, only once the local store has pulled past the report's `received_at`. A gap is raised only if it persists across **two consecutive reports** (kills timing noise), with tolerance for foreign-currency rounding (`max(0.5% , 1 minor unit × fx)`).
- Gap surfaces as the amber row + Fix timeline. Resolution creates explicit rows: Cash withdrawal → transfer to Cash, I spent it → expense (category picker), Set aside → pocket deposit, Not sure → snooze (remind in 3 days). Never silently adjust; "adjustment" is an explicit row with a reason.
- Bank-to-bank (IPN own transfers) keep the existing shared-reference pairing and now move balance between the two accounts.
- Reports older than 14 days are purged by cron.

## 6. Money flows (write paths to touch)

Expense (any method), income event, debt payment and credit payoff, BNPL installment, recurring templates, top-up, ATM/cash-out, savings deposit/withdraw (held-in vs standalone), goal funding and `month-carry` (move to the atomic function; auto-carry only between held-in pockets so no money is minted), receipt/voice/AI-created expenses (default account = card's parent, else last used), subscriptions. Each gets: payment method selection → account resolution helper `resolveAccount(paymentMethodId)`, plus tests with real data shapes (grep the write path, not just fixtures).

## 7. AI / Buddgy
- Buddgy reads balances through a masking-aware accessor (respects privacy settings).
- Receipt/voice/AI parsing: suggest account from card last4 or merchant history; ask only when ambiguous.
- Buddgy tips: "1,200 missing on NBE" nudge links to Fix; no financial advice wording.

## 8. Privacy settings
`privacy` jsonb: `{ preset: 'off'|'hero'|'all'|'custom', hero, lists, notifications, widgets, buddgy }`. A single `useMask(surface)` hook feeds `MoneyDisplay`; push-notification bodies built server-side check the flag. Default off.

## 9. Migration and rollout

1. DB migrations + types + mappers (behind no UI).
2. Balance engine + selectors + tests; net worth switch.
3. Accounts tab (Start/Found/Home/Account) + Add account/card + backfill prompt for existing data (accounts created from payment methods; opening balance = user-entered or reported).
4. Move (cash out / set aside) and held-in pocket integration; atomic pocket function; carry/goal funding.
5. SMS account resolution, balance reports, gap detection, Fix flow.
6. Privacy settings, Buddgy masking, notifications.
7. Wealth cleanup: live data has 14 `bank` and 2 `cash` pockets (of 32). Each becomes an account (opening balance = pocket balance, `opening_at` = migration date) or stays a held-in pocket if the user marks it as savings; run a per-user preview SELECT first, then a one-time guided prompt ("Is this a savings pocket or an account?"). Pockets with `linked_payment_method_id` keep that link.
8. QA on device, then native builds only on the user's explicit request.

## 10. Verification (per CLAUDE.md)
`npm run lint` (no errors in `src/`), `npm run test`, full `npm run build` with dummy Supabase env, `tsc`, a diff audit for inverted conditions/null deref/falsy-zero/missing await, and a live-schema check against `database.types.ts` before each UI slice. New unit tests: balance engine, gap detector (persistence + tolerance), account resolver, privacy masking, migration backfill.

## 11. Risks and decisions
- Backfilling `occurred_at` is approximate for old rows (day-level); balances before the opening date are not reconstructed — opening balance anchors it.
- Opening balance for existing users: prompt once per account (default from the latest SMS balance report).
- Held-in default means pockets never change account balance; users who want a real transfer choose "standalone" at pocket creation.
- Decided: reports kept 14 days; hide balances off by default; Buddgy masks when hiding is on; Accounts is its own tab.
- Component alerts in section 3 are approved by the user (AccountRow, CardFaceChip, AccountPicker).

## 12. QA audit (2026-10-23)

Checked against the live schema, repo and mockups. Severity: **B** blocker if shipped as first planned, **M** major, **m** minor. All items below are already folded into the plan above unless marked open.

| # | Sev | Finding | Resolution |
|---|---|---|---|
| 1 | B | Plan used bigint minor units; every money column is `numeric`. | `numeric(14,2)` + decimal-safe helper. |
| 2 | B | Plan added a `kind` column; the `payment_method_type` enum already encodes account vs card. | Dropped; `isAccountType()` helper. |
| 3 | B | Cash "account" backfill would attribute 440/587 historical null-method expenses to Cash and show a hugely negative balance. | `opening_at` rule: deltas before it are ignored; null = default Cash by resolver, no rewrite. |
| 4 | B | `pm_default_cash` is a non-UUID sentinel, never synced; a real Cash row needs a store remap and removal of the sync filter and null-emit in the mappers (affects expenses and debt payments). | Store migration (v17-style), mapper + `sync.ts` change, with a round-trip test and an offline-queue test (pending ops that still carry the sentinel). |
| 5 | B | SMS balance extraction does not exist; learner gates deliberately block balance capture. | New parser capability with its own gates (section 5); gap detection degrades to manual Update without it. |
| 6 | M | Plan re-added `debt_payments.payment_method_id` (exists). | Removed. |
| 7 | M | `held_in_payment_method_id` vs the existing `savings_accounts.linked_payment_method_id` (used by PocketFormSheet/AddHoldingSheet to tie a pocket to a method). | Separate column with distinct meaning; documented; code paths reviewed so neither is reused for the other. |
| 8 | M | `account_balance_reports` is not in `sync_pull`, and `sync_table_delta` needs `updated_at`/`deleted_at`. | Fetched through `account_gaps`; not synced. |
| 9 | M | 2 users have two cash methods (10 cash rows / 8 users). | Default cash = the Cash account; the other stays a separate cash account. No merge. |
| 10 | M | Atomic pocket function must keep `balance_after` and avoid double-apply on retry. | Idempotent per `transfer_group_id`; service role only. |
| 11 | M | New RPC/view access: `SECURITY DEFINER` functions need `set search_path`, revoked public execute, and RLS on the new table. | Added to 0152/0154; run `get_advisors` after each migration. |
| 12 | M | Credit-card payoff: `debts.linkedPaymentMethodId` already links a credit-card debt to its method; the payoff source account must come from the payment (`debt_payments.payment_method_id`), not the card's parent. | Resolver reads `debt_payments.payment_method_id` first, parent account second. |
| 13 | M | `directionGuard`/pairing run before account resolution; an own-transfer pairs two logs, each must resolve its own account (IPN with two last4s: `account_last4` and `counterparty_last4` both exist). | Resolve account from `account_last4` for the debit leg and `counterparty_last4` for the credit leg. |
| 14 | m | Hide-balances must also mask card strip amounts? (Strip shows no amounts; last4 stays visible.) | No change; last4 is not masked. |
| 15 | m | Mockup: "Set aside" and "Cash out" buttons both link to Move in cash mode; Fix timeline amounts are static. | Prototype limitation, noted; real app opens Move in the matching mode. |
| 16 | m | Mockup: tapping NBE Salary opens Fix (not an account page) because the prototype has one account page. | Real app: row opens the account; the alert opens Fix from the account page and the home badge. |
| 17 | m | Wealth: 14 bank + 2 cash pockets must be migrated or the same money is counted twice. | Guided one-time prompt (section 9, step 7). |
| 18 | m | Offline: balance is derived locally, so it works offline; the gap/report fetch must be skipped offline and not block render. | `account_gaps` fetch is best-effort with `useNetworkStatus`. |
| 19 | m | Currency: USD account shows an EGP estimate; foreign gap tolerance needs the day's rate. | Tolerance = max(0.5%, one unit); estimate flagged as approximate (`≈`). |
| 20 | m | RTL: layout stays LTR per the design system; card strip order must not flip. | Fixed `dir=ltr` on the strip. |

Open (needs a decision or device test): the exact tolerance numbers; whether Cash's opening balance should default to 0 or to "counted so far"; on-device verification of the keypad and strip at 320px width.

## 13. Release-readiness review (senior-team pass)

Decisions are chosen for the best user experience first, then for long-run scale. Each row is a risk found, and what ships.

### Data integrity and sync
| Risk | Decision |
|---|---|
| `expenses.payment_method_id` and 8 other FKs are `ON DELETE SET NULL`; the app's `deletePaymentMethod` removes the row. Deleting an account would silently re-route its history to Cash (null = Cash). | Accounts with ledger rows cannot be deleted, only **closed** (`closed_at`, hidden from lists, history kept, balance must be 0 or moved via Cash out/adjustment). Deleting a card is allowed (cards carry no balance). A DB trigger blocks hard `DELETE` of account-type rows that have referencing rows. |
| `parent_id` of a closed/deleted account. | Closing never silently orphans: its cards become standalone after confirmation ("2 cards will stay as standalone cards"). `on delete set null` stays as the backstop. |
| `paymentMethodToRow` is a column whitelist; new columns not added there are dropped on every sync, and `paymentMethodFromRow` would lose them locally. | Add `parent_id, opening_balance, opening_at, closed_at, track_sms` to both mappers, `delta.ts`, the `PaymentMethod` type, a store migration, and the round-trip test. |
| Old app builds in the wild upsert `payment_methods` with a whitelist. | Safe by design: an upsert only writes the provided columns, so old clients cannot erase new columns. All migrations are additive (no drop/alter-type), so an app rollback needs no DB rollback. `UpdateGate` sets a minimum version once the Accounts UI ships. |
| Two devices edit the same account (LWW whole-row). | Balance is derived from an append-only ledger (union merge), so concurrent entries never conflict. Only metadata (name, parent, opening) is LWW; `opening_balance` changes through "Correct opening balance" (rare) and normal fixes go through adjustments. |
| Multi-currency. | Account has one currency. Ledger rows in another currency convert at the row's stored rate; a missing rate flags the account "approx" (`≈`), never a silent zero. Hero totals show `≈` when any conversion is involved. |
| Refunds, subscriptions, recurring templates, BNPL, receipts, voice, Buddgy-created expenses. | All go through one `resolveAccount()` + ledger selector; refunds credit the original paying account; each source has a test using the *real written shape* (grep the write path, not a hand-built fixture). |
| Own transfers (IPN, cash-out). | One expense row with `payment_method_id` (source) and `to_payment_method_id` (target) = two deltas, excluded from spend by the existing non-spend rule. Fee margin stays an expense on the source. |
| Credit card with a parent bank. | Spend is never an account delta; payoff is a debt payment whose `payment_method_id` names the paying account. If missing, the card's parent is the suggestion in the payoff sheet, not an assumption in the ledger. |
| Held-in pockets exceed the account balance. | `free = max(0, balance − Σ held)`, amber hint "Set aside is more than the balance"; Move validates against `free`. |
| Negative balance (overdraft). | Shown with a minus in amber (red is for destructive actions only) and an "Overdrawn" pill; never clamped in storage. |

### Scale and performance
- Balances are **never stored and never computed in SQL**: one memoized O(n) pass groups the ledger by account per store version and yields every `asOf` checkpoint the net-worth trend needs in the same pass. Target: 20k ledger rows under 20 ms on a mid-range Android (perf test).
- Long-run escape hatch already designed in: `opening_balance` + `opening_at` is a checkpoint, so a future "archive older than 2 years" job can roll the anchor forward with no schema change.
- Reports are bounded (14 days, indexed, purged inside `housekeeping`); no new cron, no per-row triggers on hot tables, new FKs use partial indexes so existing write paths pay nothing. `sync_pull` gains one list (`account_adjustments`).
- Net-worth trend: history before the first `opening_at` keeps the legacy formula and the chart marks the switch ("Accounts tracked from Oct 23"); no fake cliff, no rewritten history.

### Security and privacy
- New tables have RLS on: select/insert/update/delete own for synced lists, select own only for reports (written with the service role inside `/api/sms/parse`). `SECURITY DEFINER` only for `adjust_pocket_balance` (service role only, fixed `search_path`); `latest_balance_reports()` is `SECURITY INVOKER`. Run `get_advisors` (security and performance) after each migration.
- Masking applies at the data boundary, not per component: `useMask(surface)` for UI, the server notification builder, the widget snapshot writer (`widgetBridge`), analytics (balances are never sent), logs, and Buddgy tool results (`lib/buddgy/tools/exec/*` mask before the model sees them).
- No balances in server logs; `balance_after` follows the existing `sms_parse_log` retention (`sms-retention` cron).

### SMS and AI
- `track_sms=false` accounts skip report writes and gap detection but still resolve spending.
- Account resolution order: card `last4` → the card's parent; account `last4`; bank name + single account; else a one-time "Which account?" prompt, remembered per sender.
- Balance gate rejects: `balance == amount`, a currency different from the account, and a jump more than 10× the previous report with no matching ledger movement (flagged, not written).
- AI `balance_after` is untrusted data: validated numerically, never treated as an instruction. The template learner may learn a balance group only when behavioural validation shows the amount group is unaffected (shadow mode first, like the existing quarantine).
- iOS ingests SMS through the existing shortcut/ledger-first path, so **Found** is driven by `sms_parse_log` history grouped by (bank, last4), not a live inbox read. No history → Start sends the user to Add by hand with a one-line explanation.

### UX gaps closed in the design
| Gap | Fix |
|---|---|
| Debts had no entry point from Accounts. | "Credit cards and debts" row under Wallets (shows total owed) plus the "Credit owed" hero cell as a shortcut. Mockup updated. |
| Found shows balances that may not exist. | Accounts without a balance-bearing message show an inline "Add balance" field and are excluded from totals until set. |
| Existing users' accounts have no opening balance. | Accounts show "Set balance" and are excluded from hero totals and net worth until set (never a silent zero). Cards are suggested to a bank by name/last4 in a one-time "Link your cards" prompt; unlinked cards stay valid. |
| Stale data. | The hero "Updated …" chip uses the latest balance report time; older than 7 days turns amber with an "Update" action. |
| States. | Every screen specifies loading (instant, derived locally), offline (no report fetch, banner), empty, error, closed account, zero-card account (carousel shows only the add slide), 0 free (Cash out disabled with the reason). |
| Accessibility. | Card chips and rows ≥ 44px; every control labelled; switch semantics; amber text meets AA in both themes (verify with tokens); reduced motion respected (`MotionConfigRoot`); keypad also works with the hardware keyboard on web. |
| i18n. | All new copy through `dictionaries/en.ts` and `ar.ts` (types enforce parity); layout stays LTR, digits Latin. Terms fixed: **Cash out**, **Set aside**, **Free to spend**, **Credit owed**. |

### Release process
1. Ship additive migrations → regenerate types → `get_advisors` → SMS route (tolerant of both shapes) → client.
2. Behind a per-user remote flag `accounts_v2` so the owner dogfoods on a real account first; the legacy net-worth path stays until the flag is removed.
3. CI parity locally (lint, tsc, test, build with dummy env) plus new suites: balance engine (property tests: order independence, idempotence, `asOf` monotonic), gap detector (skew, persistence, FX, auto-resolve when the user logs the expense), account resolver, mapper round-trip, sentinel remap, offline queue with pending sentinel ops, masking on every surface, i18n parity, perf (20k rows).
4. On-device QA matrix: iOS and Android, 320/390/430 px, light/dark, English/Arabic, offline, second-device conflict.
5. Observability: counters (no amounts) for gaps raised/resolved, resolver misses, report rejects and adjustment rate in the admin portal; alert on the resolver-miss rate.
6. Native builds only when the user explicitly asks.
