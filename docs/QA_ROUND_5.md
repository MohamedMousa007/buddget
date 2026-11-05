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

## Fixed in the first pass (27, each with a test unless noted)
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

## Second pass (same day, after your replies)
| ID | Fix |
|---|---|
| SIT3 | privacy policy section 7 now says what the app does: expenses as CSV from Settings, a full copy by writing to support within 30 days. Site FAQ (EN and AR) matches, and "Data export" is no longer listed as a Plus feature |
| SIT1 | the retention job no longer waits for a human "pattern review" that was never recorded (migration 0229, applied live). Messages that are learned, masked and not awaiting you are blanked at 30 days. 170 rows qualify and will be blanked by the scheduled 00:50 UTC run (not run by hand). Site copy now says "deleted within 30 days (7 days if rejected or holding a one-time code)" |
| SIT2, SIT4 | policy sections 2 and 6 agree on SMS retention and now disclose Buddgy's saved memory notes and usage counts |
| AI-1 | failed chat calls no longer count toward the daily chat cap or the chat turn count (migration 0230, applied live) |
| SYN1 | the last-flushed state is remembered as one short hash per row. At a warm start, rows edited, created or deleted while the app was closed or offline are found and sent by the first reconcile. First run after the update trusts the cache as before |
| AI-5, AI-6 | `update_expense` is rejected when the currency cannot be converted; `update_goal` resolves its target like the other actions (no first-substring guess) |
| BUD3 | the "goal needs more than your plan can spare" question is no longer asked for goals set as a monthly amount |
| UIS1 | the payment card carousel takes the arrow keys and Enter/Space (focusable group, labelled with the active card) |
| PRF3 | `/api/cron/month-carry` scheduled daily at 05:00 UTC after a read-only dry run (`?dryRun=1`: 39 users, 34 cycles, 3 carries totalling EGP 44,247.68 and SAR 1,071.78, 0 failed) and your sign-off |
| PRF9 | the old Linear bot LaunchAgent is unloaded and its plist renamed `com.buddget.linearbot.plist.disabled` |

## Third pass ("fix all"): remaining P2s and the 66 P3s
Four fixer agents took the P3s by area (each appended a `## Fix status` section to its reports); I took the open P2s.

| ID | Result |
|---|---|
| AI-7 | a receipt scan whose answer cannot be parsed is settled as an error and no longer uses a monthly scan |
| SIT10 | an export table the database cut short (1,000-row response cap) is reported incomplete instead of exported silently short. Paging a longer table is not done (largest live user: 282 expenses) |
| WLT1 | the Spend withdrawal copy now says what it does ("Leaves savings, not logged as an expense"). Booking an expense instead stays a product decision |
| MON-6 | net worth on the legacy basis reads the current cycle, not the month being browsed (type-checked, no hook-level test) |
| SYN5 | goal edits are stamped and the server `updated_at` is read back, so a pull in flight no longer overwrites a local goal edit. Other types unchanged |
| SYN7 | merge compares times as instants (`Z` versus `+00:00`). Device clock skew is not fixable on the client |
| P3, 44 fixed | MON-4, MON-5, WLT4, WLT5, BUD2, API-7, API-8, API-10, API-11, API-12, SIT7, SIT6, DBL-2, DBL-4, DBL-5, DBL-6, DBL-10, DBL-11, SMS2, SMS5, AI-8 to AI-12, HKS6, HKS7, UIS2, UIS4, UIS5, UIS6, UIS7, UIS9, PRF1, PRF2, PRF4, PRF5, PRF6, PRF7, PRF10, PRF12, PRF13, SYN8, MON-7 |
| P3, 3 partial | HKS5 (error banner added, confirm-before-replace is a product call), UIS8 (three files moved to tokens; the rest feed `rgba()` or framer), PRF11 (two hooks use selectors) |

Database changes applied live (migration 0231): the three positive-amount checks validated; 13 foreign-key indexes added; two redundant indexes dropped (`idx_expenses_user`, `push_tokens_user_idx`); write privileges revoked from `authenticated` on five tables whose only policy is SELECT; cron run details kept 7 days. Not applied: dropping `sms_parse_log_user_hash_idx` (its predicate differs from the unique index, so it is not redundant), dropping the `qa2_backup` schema (destroys backup copies of user rows), ledger repair.

Also: the Android manifest lost a catch-all `app.buddget` link filter (nothing in the code uses that scheme except the auth callback, which keeps its own filter); `sharp` bumped to 0.35.5; `@types/next-pwa` removed (its nested Next 13 was the critical audit finding); all six other crons now accept POST like `notifications`.

## Still open (22: 3 P2, 19 P3)
| ID | P | What | Why |
|---|---|---|---|
| API-4 | P2 | biometric enrolment needs only a valid session | a recent-sign-in check needs a password prompt in the app and breaks enrolment on installed builds until they update |
| SMS3 | P2 | pairing race (static) | needs a concurrent database test; changing the pairing function without one could split real transfers |
| SYN6 | P2 | blind upsert, last pusher wins | needs a server-side `updated_at` precondition on every synced table |
| MON-2, MON-3, BUD4, API-6, SIT8, SIT9, SMS6 | P3 | legacy weekly count, Egypt weekend, unused budget answers, and others | product decisions |
| WLT9, SMS4, SYN9, DBL-1 | P3 | need a schema or database function change (payment-to-withdrawal link, FX pair direction, `sync_pull` deleted ids, migration ledger repair) | database writes beyond hygiene |
| API-9, API-13, PRF8, DBL-3, HKS5 | P3 | design change, intentional unscheduled cron, FileProvider paths (needs a device), backup schema drop, confirm-before-replace | risk or decision |
| LIV | - | the live sweep ran at the end of the day (below); light theme, tablet and desktop widths were not repeated | |

## Live UI sweep (run last, machine quiet, pane visible)
Dark theme and Arabic, mobile 375px (and 320px on four routes). 14 routes and 13 sheets. axe, overflow, tap-target and hit tests, plus real keyboard presses and a stress-data check.

| Result | Detail |
|---|---|
| Clean | no horizontal scroll on any route at 375 or 320; no unnamed controls or images; one visible h1 per route; Tab order is logical and every sampled stop shows a focus ring; real Escape closes a sheet and focus enters each sheet; sheets fit the viewport |
| Fixed | **Seven sheets** (income, payment methods, debt, debt charges, cleared vault, installment provider, edit income event) opened a dialog with no accessible name. They read the title id in the component that renders the shell, where the context is empty. A `ModalHeading` helper reads it below the shell, and a guard test fails if the pattern returns. **Goals empty state** headings jumped h1 to h3 (now h2). **Arabic merchant names** were cut at their start, because the app keeps LTR layout and an Arabic string overflowed on the wrong side (`dir="auto"` on the row title and subtitle) |
| Not a defect | the two contrast hits on Subscriptions are the YouTube and Apple Music logo tiles (exempt) |
| Open, minor | amounts of about 100 million are cut with an ellipsis in the three-cell strip at 375px (the band already steps its size down, but not far enough); small tap targets remain on "Set budget", filter chips, the emergency-fund chip and the price refresh icon (design call); `region` best-practice notes for visually hidden text on two pages |
| Not done | light theme and tablet and desktop widths were not repeated; double-submit and browser back inside nested sheets were not exercised in the live app |

## Not covered (stated plainly)
Dark and Arabic visual sweeps, keyboard-only sweep, narrow and wide widths, stress data in the live app (the sweep did not run); real-device native paths; Buddgy model behaviour with the live model; terms, cookies, admin UI; analytics, spending, history months, reports hooks; recurring-expense generation; `useDebtTabData` maths; most form-level validation (double submit, 1e21, Arabic digits, state reset); a New York time-zone run of the money area.

## How far from bug-free
- Known open: 0 P0, 0 P1, 3 P2, 19 P3 (22 of 114). 92 findings fixed fully or partly.
- Discovery is still not saturated: three of the four densest areas (sync, API, forms) had not been probed this deeply before and gave P1s; the live-UI layer produced nothing because it could not run.
- Assurance score (judgement, 18 segments x depth 0-3): up from 34/54 (63%) to about 40/54 (74%), mostly from the API matrix, the English/Arabic diff (clean: 3,447 keys each), selector timings (linear, 91 ms at 40k transactions) and code-level sync review. A release gate would want 80%+ with native, AI, offline and live UI at 2.
- Next, by yield: (1) live UI sweep on a production build, (3) render tests for the sheets and carousels (UIS1, forms), (4) real-device checklist, (5) Playwright smoke for the nine journeys.
