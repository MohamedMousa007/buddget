# Test plan

## What governs this plan
`CLAUDE.md`, "What to test: by risk, not everything" (owner rule, 2026-11-20), confirmed by the owner the same day. It overrides the brief's "Playwright for every issue":
- UI-only items get a mockup and the owner's review, not a spec.
- Deep technical items always get tests.
- Playwright runs at **workers 1**, on the **cloud QA runner**, never on the Mac.
- New cases go into the existing suite files, in the existing style: fresh synthetic `qa-e2e-*` users, `test.fail` with the issue id until the fix lands, a row in `e2e/README.md`, 0 synthetic users left at the end.

## How each fix is proven
Test first, per item, at the start of its fix: write the case, run it on the runner, record that it fails for the stated reason, fix, rerun, then run the neighbouring suite. No assertion is weakened to pass. No failing test is committed without `test.fail` or `it.fails` and its id.

**No spec code has been written yet.** Reasons: the plan is not approved and four fixes change shape with the owner's decisions; and this session cannot reach a runner (see `09-playwright-results.md`). The cases below are specified to the level of file, steps and assertion, and each "fails today" claim rests on code that was read or on live data.

## Coverage matrix

Types: **U** unit (Vitest, runs in `npm run verify`), **A** API or SQL integration, **J** Playwright journey, **N** device, **O** owner review.

| ID | Tier | Type | Where | Case and assertion | Today |
|---|---|---|---|---|---|
| BDG-001 | DT | U | `src/lib/supabase/remote/__tests__/mappers.test.ts` | `settingsToRow({theme:'system'})` uploads `system`; round-trip keeps it | fails |
| | | U | `remote/delta.test.ts` | a pull returning `system` keeps local `system`; a pull never replaces a newer unsent choice | first part fails |
| | | J | `specs/round2/r1-core.spec.ts` (new R18) | for light, dark, System: set, sync, reload twice, open three Settings sub-pages; assert the server row and `html[data-theme]` | fails for System |
| | | J | same file (new R19, two contexts) | **Mandatory.** A sets light; stale B, behaving like an installed build (uploads `dark` for System), reloads; A reloads; A still light and server says light. Also: a new account with no settings row starts light | unknown: this test decides whether the edit-stamp rule is built |
| BDG-008 | DT+N | U | new `src/lib/sms/setupState.test.ts` | derivation of preference, wired, verified, health for: never set up, exit midway, finished, skip confirmed, token failure, reinstall, second phone, account switch, no SMS yet, first SMS, quiet for N days | n/a (new function) |
| | | A | `e2e/sms/` | first SMS sets `first_sms_at` once; a second does not move it; another device's SMS does not touch it | fails (no column) |
| | | J | `specs/a-onboarding.spec.ts` + Settings | guide: exit midway keeps "Set up"; Finish shows "Not confirmed yet"; skip asks to confirm; same component in both places | fails |
| | | N | device | Shortcut run, reinstall, X position | see file 10 |
| BDG-011 | DT | A | SQL test on a database branch | settle an `error` row with tokens: the session window does not move | fails |
| | | U | `src/app/api/buddgy/turn/route.test.ts` | hop 1 `calls`, hop 2 failure: turn exempt; finished turn replayed: refused; Retry: one charge; two concurrent requests: two turns, no double count; insufficient credits: refused before the model call; a request with no `turn_id` (installed build) is charged per request and never gets a free tool step; Sparks charged once per turn; Stop after streamed text is charged, Stop before any text is free; a cut stream followed by Retry returns the answer with one charge; exempt rows still count toward the per-minute rate | fail |
| | | U | `runTurn.test.ts` | every failure kind draws a bubble with Retry | fails for Stop and nav-only |
| | | J | `specs/g-buddgy.spec.ts` | with the model stand-in returning an empty reply, `/api/entitlements/me` usage is unchanged and an error bubble shows | fails |
| BDG-013 | DT | U | `src/lib/buddgy/history.test.ts` | a 3-turn chat past the spend line still sends 3 turns; a long chat trims by size and keeps the last N turns | fails |
| | | U | route test | `soft` does not set the note; a rolled chat carries the recap | fails |
| | | J | `specs/g-buddgy.spec.ts` | state a fact in turn 1, force the roll, ask for it: answered; a 2-turn chat shows no "long chat" note | fails |
| BDG-019 | DT+N (end to end **Blocked** on store setup) | U | new `src/lib/billing/purchaseFlow.test.ts` | no package: message beside the button with Retry; configure failure surfaced; success only on a store-sourced row; trial is not "paid"; Restore with nothing says so | fails |
| | | N | device sandbox | real purchase, cancel, restore | blocked on store setup |
| BDG-020 | DT | U | `src/lib/billing/subscriptionView.test.ts` | rows of the Manage sheet per store and state; trial shows "trial ends on"; "cancelled" only from a webhook state | fails |
| | | A | `e2e/api/round2/pro-rewards/` | `/me` returns `store`; missing cases: cancel then uncancel, billing issue, refund, transfer, plan change | missing |
| BDG-022 | DT | A | same suite | an Apple expiry does not end a Google-owned row; out-of-order events | first fails; built only at the launch gate |
| BDG-009, 016 | CX | J | `specs/round2/pro-rewards/10-screens.spec.ts` | open chat, type a draft, tap the ring: a dialog is visible, `location.pathname` unchanged, draft kept; close; repeat three times; one sheet at a time | fails (path changes) |
| BDG-012 | CX | U | `src/lib/i18n/buddgyChatCopy.test.ts`, `usageNotices.test.ts` | a week reset shows weekday and date; a rate block has its own text and Retry; a second block in chat still shows the sheet; Free, Pro and Sparks offers | fail |
| BDG-010 | CX | U | route test | a fallback reports the model that answered | fails |
| BDG-015 | CX | U | `src/lib/buddgy/tools/__tests__/navigation.test.ts` | with consent granted, `start_budget_setup` returns a card and does not navigate; consent does not survive "New chat"; every one of the 67 tools has an effect class; a tool that writes financial data or settings cannot apply outside its confirm rule (DT) | fails |
| BDG-014 | CX+N | U | geometry helper test | panel height and top from a visual viewport with a keyboard; `fit()` does not save while the keyboard is up | fails |
| BDG-017 | CX+N | U | `src/lib/navigation/` | `goBack()` runs guards first, no-ops with no history, mirrors in Arabic | n/a (new function) |
| BDG-026 | CX | J | `specs/d-pockets.spec.ts` | type an amount, add a pocket inside the sheet, return: new pocket selected, amount intact; zero pockets shows the action | fails |
| BDG-027, 028 | CX | J | same spec | 6 pockets and 6 accounts selectable from the picker; keeps the label "From account …" | fails |
| BDG-003 | CX+N | U | `FlipCardRig.test.tsx` | exactly one face visible at 0, 89, 91, 180 degrees, both directions | fails |
| BDG-018 | CX | U | orb position test | release left of centre snaps left, right snaps right, limits respect safe areas, Arabic mirrors | fails |
| BDG-002 | UI | O + U | mockup; `src/hooks/useSetupProgress.test.ts` | owner review; the unit test is updated because counting only applicable steps changes the calculation | n/a |
| BDG-004, 005, 006, 007, 021, 023, 024, 025 | UI | O | mockup, then a screenshot of the build | owner review. One small unit check rides along: a registry test that biometrics and App lock share a route | n/a |

Counts: 28 issues. 8 by owner review only, 1 by owner review plus a unit test. 19 with automated cases: about 34 cases (22 unit, 4 API or SQL, 8 journeys). 6 also need a device.

## Visual checks
For every UI item: a before-and-after mockup first, then one screenshot of the build in English light and Arabic dark at 375 px, from the cloud runner. The existing sweep (`e2e/ui/pro-rewards-sweep.mjs`) covers axe, tap areas and sideways scroll on the Pro, Rewards, Invite and Settings screens; it is rerun once at the end, not per change. It cannot measure Arabic yet (job 10); that must be fixed before it counts.

## Test data
Every case creates its own `qa-e2e-*` user and deletes it. Nothing touches real testers' rows. Billing cases use the suite's signed local test secrets, never a real store account. Buddgy cases use the model stand-in described in `docs/buddgy/INTERNAL_GUIDE.md`, so they cost nothing and do not depend on the provider.

## Regression runs after each phase
- Phase 1: `npm run verify`; `e2e/sync` live tests; journeys R13 to R19; `g-buddgy`; the pro-rewards API suite.
- Phase 2: journeys A to G, N, Q, S; the pro-rewards journeys.
- Phase 3: the UI sweep once.
