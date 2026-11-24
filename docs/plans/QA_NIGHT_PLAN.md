# QA Night Plan (2026-11-24)

Prompt: `docs/plans/QA_NIGHT_MASTER_PROMPT.md`. Branch: `claude/qa-bugs-wealth-logic-905035`. Findings: `docs/plans/qa-night/`.

## Phase 0 — Discovery (parallel, read-only)
- [x] A-cards-accounts (Bugs 1, 2, 5, 6, 7, 10) — Opus → `qa-night/A-cards-accounts.md`
- [x] A-accounts-misc (Bugs 3, 4, 9, 15) — Opus → `qa-night/A-accounts-misc.md`
- [x] A-flow-notifications (Bugs 8, 12, 13, 14) — Opus → `qa-night/A-flow-notifications.md`
- [x] B wealth review (10 sections + edge-case matrix) — Fable → `WEALTH_LOGIC_REVIEW.md`
- [x] C support current state + D test inventory — Sonnet → `qa-night/C-support-current.md`, `qa-night/D-test-inventory.md`

## Phase 1 — Decisions (council)
- [x] Council on Track B open decisions; log below.
- [x] Orchestrator decisions on Bug 14 reachability of hidden transactions, Bug 9 reject semantics, Bug 15 currency-change semantics.

## Phase 2 — Track A implementation
- [x] Bugs 1,2,5,6,7,10 — 1a8476b6
- [x] Bugs 8,12,13,14 — ebc9aa8d
- [x] Bugs 3,9,15 — 21397a20 (migration 0345 applied live; advisors: no new findings)
- [x] Bugs 4,15,14-reachability — b058352f

## Phase 3 — Track B implementation (Bug 11 folds in here)
- [ ] Phase 0 items 0.1–0.7 (0.7 = Bug 11) — Fable agent running
- Phases 1–3 deferred to owner (council verdict)

## Phase 4 — Track C support experience
- [ ] Support redesign (items 1–11) — Opus agent running

## Phase 5 — Integration
- [ ] Review + merge other sessions' PRs.
- [ ] `npm run verify`.
- [ ] Local Playwright campaign; fix loop until green.

## Phase 6 — Ship
- [ ] Merge to main, fast-forward dev, confirm.
- [ ] Linear tickets for device-only checks → Mohamed Salah, Karem Hazim.
- [ ] `bash scripts/native-release.sh` (iOS TestFlight + Android Drive).
- [ ] Final report with the four labels.

## Council: Wealth model (2026-11-24 night)
- **Architect (orchestrator):** adopt model + D1–D12; ship Phases 0–1 tonight, Phase 2 if green.
- **Skeptic (Fable):** adopt model; Phase 0 only. Phase 1 trigger that NULLs `held_in` breaks R14/D2. "Cash at home"/"Wallet" as outside homes duplicate the system Cash account and wallet accounts.
- **Pragmatist (Opus):** adopt model; Phase 0 only (0.1→0.7, 0.7 last). Everything that rewrites history or changes a number's meaning waits.
- **Critic (Fable):** adopt model; Phase 0 only. Release UI without D4 is a lie; D11/D12 defer; Arabic `محجوز` reads as a bank freeze.
- **Verdict:** three voices against my initial position → changed. Ship **Phase 0 tonight** (0.1–0.7; 0.7 = QA Bug 11). Phases 1–3 wait for the owner.
  - D1 one home, D2 flag (no silent change), D6 refuse close in client, D7 receivables out, D8 deferred (needs snapshot basis), D9 deferred, D3/D4/D5/D10/D11/D12 deferred; D11 keeps today's behaviour.
  - 0.7 "Where is this money?" lists tracked accounts **including system Cash and wallet accounts** first, then "Somewhere else"; never offers a Cash/wallet outside home that duplicates an account.
  - Copy: avoid `محجوز`; use `مجنّب في CIB` / "Set aside in CIB"; one dialect per flow.
  - Phase 1 trigger (later) must reject/flag, never NULL `held_in`.
  - Strongest dissent kept: Skeptic's D3 objection (opening vs first-add treated differently) — unresolved, owner to decide.

## Waiting on owner
- linear-tickets-audit worktree: ~100 files uncommitted, tsc clean, migration applied live as 0344 and will be renamed 0345, awaiting owner "ship it" in that session. Overlaps this branch (AccountDetailSheet, accounts/flow pages, useFlowLedger, netWorth/useNetWorth, push/register) — it rebases on top of this branch.

## Decision Log
| # | Question | Verdict | By |
|---|---|---|---|
| D1 | Which card types get a linked-account field? | Debit + credit (credit = grouping only); hidden for prepaid/wallet/service; "None" always offered | Orchestrator |
| D2 | Card currency vs account currency | May differ; defaults to linked account's currency | Orchestrator |
| D3 | Provider change inside Add-card from an account | Re-check link (one matching account → it, else None); never on first open | Orchestrator |
| D4 | "Other cards" section on Accounts | No; unlinked methods stay in Payment Methods | Orchestrator |
| D5 | Relinking a debit card with history | Confirm sheet first; credit needs none | Orchestrator |
| D6 | Store dedupe path drops new link | Adopt the new link | Orchestrator |
| D7 | Unlink vs SMS cap | Unlinking never disables SMS tracking; tested | Orchestrator |
| D9 | Bug 8 prompt | Skip when this device already notify=true; explicit "No" honoured at boot | Orchestrator |
| D10 | Bug 12A swipe | Vertical-up only (snooze kept); dots become tappable to reach cards 2+ | Orchestrator |
| D11 | Bug 12B | Income prompts on All and In (`segment !== 'out'`) | Orchestrator |
| D12 | Bug 13 | Time shown in details only when a real same-day timestamp exists; no time in rows | Orchestrator |
| D13 | Bug 14 | Chip + message removed; internal moves hidden; empty state fixed; rows reachable later via account detail | Orchestrator |
| D14 | Bug 3 missing assets | Merge logo maps + onError fallback; 49 unlicensed brands not sourced (Linear ticket for owner) | Orchestrator |
| D15 | Bug 9 "Not mine" | Reject closes the account (keeps SMS matching it); Undo reopens | Orchestrator |
| D16 | Bug 15 Cash currency change with balance | Ask amount in new currency (prefilled converted), record via balance adjustment; follow main currency only while empty | Orchestrator |
| D17 | Seeded AED Cash row | Realign only if zero balance and zero transactions | Orchestrator |
| D8 | Local Playwright vs cloud-runner rule | Local, per owner's chat instruction 2026-11-24 | Owner |

## Council: Round 3 follow-ups (2026-11-24)
- **Q1 money lent / borrowed (debt principal leg).** Architect, Skeptic, Critic: fix now, guarded — store the account on the debt, one explicit "Did this money leave CIB now?" question (default yes only for today/after opening), link an existing SMS transfer instead of a second debit, existing debts untouched, receivable stays out of net worth (D7). Pragmatist dissent: copy-only tonight, the leg tomorrow (deep change, migration). Verdict: guarded fix, with mandatory tests. Finding: DR-6's "lending lowers the account" was false in code; repayments minted money.
- **Q2 Close account confirm.** Unanimous: pass `confirmLabel` (button "Close account" / «إغلاق الحساب»), keep it red, body says it can't be reopened from the app (no reopen exists). Shipped e77d0138.
- **Q3 borrowed money as income.** Unanimous: borrowed money is never income (it's a liability). Predicate on income events/one-time sources with `sourceType 'debt'` or `linkedDebtId`, in every income aggregate (not balances); Flow shows "Not income"; past months restate (pre-launch). Critic conditions adopted: close the mis-link path first (a salary must never be offered as the borrowed deposit; incoming link defaults off), unlink restores the event's previous type, check an i_owe repayment isn't also counted as spend.
- **Q4 bank SMS arriving after a debt with a leg.** Critic + Architect: detect client-side on arrival, both directions; show a "possible duplicate" prompt, never auto-drop; on confirm keep the bank row (link patch) and clear the leg.
- **Q3 + Q4 built (unit-tested, not yet on a device).** `isBorrowedMoney` (`src/lib/income/borrowed.ts`) in every income aggregate; the link no longer rewrites the credit's type, so unlinking restores it; a payday-shaped credit is never offered and the incoming link defaults off. Late rows: `src/lib/debts/principalDuplicate.ts` + `PrincipalDuplicatePrompts` on Flow, "No" remembered in `settings.promptState` (`principaldup:<debt>:<row>`).

## Council: L1 findings A–D (2026-11-25)
- **A held-pocket Add money.** Unanimous: both — default "From account" to the holding account (capped at its free) and cap any other source at its own free money, in `depositRefusal` (store-level), labelled as a transfer. Critic additions adopted: refuse a cross-currency source with no FX rate.
- **B deleted rows resurrected by an in-flight pull.** Unanimous: generic sync bug for every list entity. Critic's invariant adopted over the lighter `delivered` filter (mount pull runs with no baseline): a persisted pending-delete set, cleared on server ack, Undo removes; no pull may re-add an id in it; stamp `deleted_at` at delete time, not flush time. Tests first.
- **C delete warning.** Copy follows the computed net-worth change, not pocket type; unchanged → "stays in {account} and becomes available again"; falls → today's sentence. Arabic in the neighbouring MSA register.
- **D truncated Flow title.** Additive `TransactionRow` variant (badge wraps under the title when narrow), default unchanged, Flow only.
