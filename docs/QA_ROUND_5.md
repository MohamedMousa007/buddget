# QA Round 5: parallel finder round (2026-11-05)

Method: 13 read-only finder agents ran in parallel, one per area, each with the project QA skills and the shared rules in `docs/qa-round-5/BRIEF.md`. A finding counts only with evidence: `Confirmed` = a test, run or live query shows it; `Static` = code reading only. Per-area reports: `docs/qa-round-5/<area>.md`. Reproductions that were kept: `docs/qa-round-5/repro/**` (`.txt`, not run). The fixes below were made after the reports, each with a test (most ported from the agents' reproductions).

## Findings by area
| Area | Report | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|---|
| Money engine | money.md | 0 | 1 | 1 | 5 | 7 |
| Wealth, debts, goals | wealth.md | 0 | 1 | 5 | 3 | 9 |
| Budget, reports | budget.md | 0 | 1 | 2 | 2 | 5 |
| API and security | api-security.md | 0 | 3 | 2 | 8 | 13 |
| SMS and notifications | sms-notifications.md | 0 | 0 | 2 | 4 | 6 |
| AI, Buddgy, voice, receipt | ai.md | 0 | 0 | 6 | 7 | 13 |
| Sync and offline | sync-offline.md | 0 | 4 | 3 | 2 | 9 |
| Live database | database.md | 0 | 1 | 2 | 9 (one is a no-defect note) | 12 |
| Static UI, a11y, i18n | ui-static.md | 0 | 0 | 2 | 7 | 9 |
| Hooks and forms | hooks-forms.md | 0 | 2 | 2 | 3 | 7 |
| Site, admin, legal | site-admin.md | 0 | 0 | 6 | 4 | 10 |
| Performance and config | perf-config.md | 0 | 0 | 2 | 11 | 13 |
| Live browser | live-ui.md | 0 | 0 | 0 | 1 | 1 (sweep did not run) |
| **Total** | | **0** | **13** | **35** | **66** | **114** |

Round 4 fixed 12 defects. This round reported 114, so the earlier "bug free" distance was too optimistic: the first rounds sampled other slices, and each new area (sync, device routes, forms, backups) produced P1s.

## Fixed in this round (27, each with a test unless noted)
| ID | P | Fix |
|---|---|---|
| SYN2 | P1 | sign-out starts its final flush before suspending sync (a flush after the suspend flag was a no-op and pending edits were wiped) |
| SYN3 | P1 | tracked slices now include `investmentHoldings` and `receipts` (a stale `savingsHoldings` entry replaced) |
| SYN4 | P1 | `debts.goal` / `debts.emoji` columns (migration 0228, applied live), mapper and types; the payoff goal no longer vanishes on the next pull |
| HKS1 | P1 | an unchanged currency is kept on edit/prefill; "20 USD" is no longer saved as 20 EGP when only base currencies are offered |
| HKS2 | P1 | backup export includes `incomeEvents`, `receipts`, `investmentHoldings`; import schema accepts them |
| API-1 | P1 | `sms/setup-token` DELETE has the removed-phone and unregistered-phone guards GET has; new token is created before the old one is retired |
| API-2 | P1 | `push/register` checks the removed-phone header when the body has no `deviceId` |
| API-3 | P1 | removing a phone is idempotent: a retry after a failed cleanup finishes the cleanup |
| BUD5 | P1 | debt minimums are taken out of the ledger Debt category before "Extra payoff" claims it (no double count) |
| DBL-7 | P1 | `link_ids` drops non-uuid builder ids, so the budget plan syncs again (was HTTP 400 on every save) |
| WLT2 | P1 | withdraw-to-debt cannot exceed what is still owed |
| MON-1 | P1 | a weekend payday on a cycle edge shifts into its cycle instead of out of every cycle (exhaustive month-start x payday grid test) |
| HKS3 | P2 | a card with 0 grace days stays 0 |
| HKS4 | P2 | one `safeInternalPath` rejects `\`, tabs and `//` in post-sign-in redirects |
| API-5 | P2 | same-password change is refused before biometric/trusted-device bindings are cleared; Auth's "different from the old password" is recognised |
| DBL-8 | P2 | subscription detector reads `received_at` (the `day` column does not exist) |
| DBL-9 | P2 | `26/07/30` is read year-first when day-first would land in the future |
| SMS1 | P2 | OTP pre-filter catches the code before the keyword, a longer gap, and Arabic "كود التحقق"; a real purchase with a "never share your OTP" footer still passes |
| SIT5 | P2 | `sms_template_hard_signals` added to the erasure and export lists and the guard test |
| AI-2 | P2 | `change_setting` needs a tap when a read tool ran first |
| AI-3 | P2 | a turn whose last hop is still calling read tools fails visibly instead of returning a blank reply |
| AI-4 | P2 | `update_income` validates its amount |
| WLT3 | P2 | a gold pocket (XAU grams) priced against a money debt instead of paying 0 |
| WLT7 | P2 | recurring savings keep their due date when the deposit is refused |
| WLT8 | P2 | a debt-freedom goal is not marked achieved while a gold debt cannot be priced |
| BUD1 | P2 | `shave` never raises a line to its floor (saving targets no longer inflate everyday lines) |
| UIS3 | P2 | goal-achieved screen respects the top/bottom safe area (no test: visual) |

## Open, needs a decision or a larger change
| ID | P | What | Why not done now |
|---|---|---|---|
| SYN1 | P1 | edits not pushed when the app closed (offline, failed retries, debounce window) are never sent: the flush baseline is the persisted cache at warm start | needs a persisted "last flushed" snapshot or outbox. A full re-upsert on launch would let a stale device overwrite newer edits from another device (SYN6). Design call |
| SYN5-7 | P2 | rows without `updatedAt` always lose to the server copy; blind upsert (last pusher wins); device-clock comparison | same family as SYN1: needs a server-side `updated_at` precondition |
| AI-1 | P2 | failed chat calls count toward the daily chat cap (7 of 10 live chat events were errors) | needs a change to `ai_quota_reserve` / settle |
| AI-5, AI-6 | P2 | legacy voice handlers: stale base amount on unconvertible currency; `update_goal` matches loosely | not yet fixed |
| SIT1 | P2 | policy says raw SMS is kept at most 30 days; 179 confirmed rows are older and the retention job masks nothing (`parsed_masked` = 0) | you ruled no manual purge. Needs the job fixed and your OK to run it |
| SIT3 | P2 | policy promises a JSON export in Settings; signed-in users only get an expenses CSV | policy wording or product change |
| PRF3 | P2 | `/api/cron/month-carry` is in neither `vercel.json` nor pg_cron, so it never runs | scheduling decision (Hobby plan allows daily) |
| PRF9 | P2 | the old Linear bot LaunchAgent is still loaded hourly with `--dangerously-skip-permissions` | system change on your Mac. Asked first |
| MON-6 | P2 | legacy-basis net worth follows the month being viewed | needs the cycle for "now", plus no snapshot while browsing |
| BUD3 | P2 | "goal needs more than you can spare" follow-ups do nothing for by-amount goals | flow decision |
| SMS3 | P2 | pairing race (static) | reproduce first |
| UIS1 | P2 | payment card carousel is click-only (no keyboard/screen reader) | component rework |
| API-4, SIT2, SIT4, WLT1 | P2 | biometric register without recent sign-in; others listed in the area reports | see reports |
| LIV | - | the live browser sweep did not run (dev server never served `/flow` under load) | repeat on a quiet machine or a production build |
| All P3 | P3 | 66 listed in the area reports | triage later |

## Not covered (stated plainly)
Dark and Arabic visual sweeps, keyboard-only sweep, narrow and wide widths, stress data in the live app (the sweep did not run); real-device native paths; Buddgy model behaviour with the live model; terms, cookies, admin UI; analytics, spending, history months, reports hooks; recurring-expense generation; `useDebtTabData` maths; most form-level validation (double submit, 1e21, Arabic digits, state reset); a New York time-zone run of the money area.

## How far from bug-free
- Known open: 0 P0, 1 P1 (SYN1), about 20 P2 (most need a decision), 66 P3.
- Discovery is still not saturated: three of the four densest areas (sync, API, forms) had not been probed this deeply before and gave P1s; the live-UI layer produced nothing because it could not run.
- Assurance score (judgement, 18 segments x depth 0-3): up from 34/54 (63%) to about 40/54 (74%), mostly from the API matrix, the English/Arabic diff (clean: 3,447 keys each), selector timings (linear, 91 ms at 40k transactions) and code-level sync review. A release gate would want 80%+ with native, AI, offline and live UI at 2.
- Next, by yield: (1) SYN1 design, (2) live UI sweep on a production build, (3) render tests for the sheets and carousels (UIS1, forms), (4) real-device checklist, (5) Playwright smoke for the nine journeys.
