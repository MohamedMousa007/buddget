# S8d: Performance measurements (QA round 2)

Numbers only. Nothing was fixed. Date 2026-11-19. Production build (`NEXT_PUBLIC_API_BASE_URL= NEXT_PUBLIC_DEV_AUTH_BYPASS=0 npm run build`, `next start -p 3100`), live Supabase Frankfurt `tzioppxwsljhlglyducm`.

## Method and deviations

- Browser: Playwright Chromium, 390x844, touch, locale en-US, Africa/Cairo. Chrome DevTools CDP: CPU 4x, network Fast 4G (165 ms RTT, 1.62 Mbps down, 0.675 Mbps up, i.e. the DevTools preset values). Throttle applies to every request, including Supabase. Fresh context and cleared cache per run. Each flow ran 3 times per user; tables show the median.
- Users: two synthetic users, one **small** (25 expenses, 1 income) and one **large** (3,000 expenses over 365 days, 12 income events). Both were deleted at the end (verified: no `qa-e2e-pf*` user remains).
- **Deviation:** the expenses were seeded by service-role PostgREST inserts (batches of 500, own user id only), not through the app's sync path. No existing QA seed helper creates 3,000 rows.
- Timing definitions: "ms" for tab switches, sheets and Reports = in-page time from `pointerdown` to the last DOM mutation of the burst (700 ms quiet window), so it includes animations that mutate the DOM. "long task" = sum of Long Tasks (>50 ms) in that window. Sign-in times are Node wall clock from the "Sign me in" click.
- Lighthouse 12, mobile, default simulated throttling, 3 runs per URL, median.
- Scripts: `e2e/perf/` (`specs/00-seed`, `10-journeys`, `20-commits`, `99-teardown`, `lighthouse.mjs`, `bundle.mjs`, `aggregate.mjs`). Raw output: `docs/qa/round2/S8d-evidence/`.
- Not measured: QA-81 localStorage size (the store size was not read before the users were deleted). The sync response for the large user (about 150 KB over the wire at sign-in, `journey-large-*.json`) is the only size proxy.
- `next build` (Next 16.4.5) prints no per-route size column (`S8d-evidence/build.log`), so route weights below are measured from the network (JS decoded and gzipped by `bundle.mjs`).

## 1. Timings (median of 3, ms)

Full per-run values: `S8d-evidence/aggregate.md`.

| Metric | Small user | Large user (3,000 expenses) |
|---|---|---|
| Cold load, signed out: FCP (= LCP) | 3,436 | 3,468 |
| Cold load, signed out: sign-in form usable | 3,740 | 3,772 |
| Sign-in click to shell (Profile menu visible) | 11,973 (runs 12,376 / 11,973 / 7,558) | 6,207 |
| Sign-in click to first sync done | 12,001 | 6,371 |
| Sign-in click to DOM settled | 12,801 | 7,498 |
| Sign-in long-task time | 825 | 2,751 |
| Reload, signed in (cached store): to shell | 2,555 | 4,274 |
| Reload: FCP (= LCP) | 2,212 | 2,992 |
| Tab Accounts | 247 | 454 |
| Tab Wealth | 387 | 360 |
| Tab Debts | 229 | 667 |
| Tab Flow | 689 (long task 0) | 1,413 (long task 262) |
| Back to Flow (after Wealth) | 411 | 1,323 (long task 184) |
| Reports (via profile menu) | 2,964 (long task 679) | 3,213 (long task 828) |
| Wealth (second visit) | 617 | 320 |
| Open add-expense sheet (Quick add > Expense) | 1,407 (runs 586 / 1,417 / 1,407) | 1,634 |
| Save expense: click to sheet closed | 604 | 1,014 |
| Save expense: row visible after close | 33 | 75 |

## 2. QA-84 re-profile (React commits, large user, first sign-in)

Commit counter via a React DevTools hook (`onCommitFiberRoot`) installed before app scripts; CPU 4x + Fast 4G, 390 px. Evidence: `commits-large-{1,2,3}.json`.

| Run | Total commits (navigation to quiet 3 s after sign-in) | Before the Sign-in click | After the click |
|---|---|---|---|
| 1 | 463 | 455 | 8 |
| 2 | 186 | 174 | 12 |
| 3 | 236 | 224 | 12 |
| Median | **236** | 224 | 12 |

(An earlier set of 3 runs with the same setup gave 506 / 477 / 122 totals and 14 / 9 / 12 after the click.)

Result against the "under about 200" criterion: **not met** (median 236, range 122 to 506 over 6 runs). The counts are almost entirely before sign-in: 442 of run 1's commits fall in one second of the signed-out page load (`perSecond` in the JSON). Components rendering most in that burst (production names are minified; matched to source by body text): `OptionChip` (124 renders), `FlowChipRow` row component (120), the category-icon span (120), `AnimatePresence` (75), the sheet wrapper (45), an error-boundary component (37), `useSearchParams` Suspense wrappers (18 to 20 each). `FlowChipRow` source: `src/components/features/flow/FlowChipRow.tsx:27`. Commits per second after the click are 1 to 9.

## 3. Lighthouse (mobile, median of 3)

Evidence: `lighthouse.json` (all runs), `lh/signin_flow_signed_out_.json` (full report, run 1 of the sign-in page).

| URL | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | SI ms | TTI ms | CLS | Bytes | Requests |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | 85 | 100 | 100 | 100 | 1,364 | 3,966 | 286 | 1,364 | 5,372 | 0 | 696,834 | 34 |
| `/en` | 82 | 100 | 100 | 100 | 1,364 | 4,024 | 273 | 1,403 | 5,345 | 0 | 697,298 | 34 |
| `/en/pricing` | 85 | 100 | 100 | 100 | 1,362 | 3,942 | 254 | 1,362 | 5,252 | 0 | 687,379 | 34 |
| `/en/features` | 86 | 100 | 100 | 100 | 1,213 | 3,840 | 169 | 1,213 | 5,292 | 0 | 700,480 | 38 |
| `/ar` | 82 | 100 | 100 | 100 | 1,662 | 3,958 | 252 | 1,662 | 5,686 | 0 | 759,724 | 38 |
| Sign-in page (`/flow`, signed out) | **48** | 100 | 100 | **66** | 1,213 | **11,456** | **1,360** | 3,779 | 11,456 | 0 | **1,522,131** | **77** |

## 4. Bundle

Evidence: `bundle.json`. Disk: 329 JS files, 7.99 MB raw / 2.52 MB gzip in `.next/static`; CSS 281 KB raw / 49 KB gzip.

JS downloaded on a cold, unthrottled load (decoded KB / gzip KB):

| Route | JS chunks | Raw KB | Gzip KB |
|---|---|---|---|
| `/`, `/en`, `/en/pricing`, `/ar` (marketing) | 14 | 1,005 | 316 |
| `/flow` (signed out) | 64 | 4,105 | 1,284 |
| `/legal/terms` | 71 | 4,372 | 1,366 |
| `/offline` | 59 | 4,042 | 1,261 |
| `/install` | 58 | 4,037 | 1,259 |
| `/reset-password` | 68 | 4,357 | 1,359 |
| `/admin` | 63 | 4,789 | 1,462 |

Largest client chunks (gzip / raw KB): `2926-*.js` 140 / 522; `app/(app)/layout-*.js` 128 / 416 (contains Sentry); `7812-*.js` 108 / 331; `288.*.js` 93 / 305 (recharts); `9095.*.js` 76 / 247; `3794-*.js` 65 / 237; `72-*.js` 65 / 204; `4bd1b696-*.js` 63 / 199 (react-dom); `7654.*.js` 62 / 187 (Sentry); `2023.*.js` 60 / 173 (Sentry, firebase).

## 5. Network (requests per screen, median of 3)

"Data" = Supabase REST/RPC/auth and `/api/*`, excluding Sentry envelope POSTs (`/api/<id>/envelope/`, counted separately). Evidence: `journey-*-*.json` (`requests`, `net`).

| Step | Data requests (small / large) | Sentry envelopes | Static requests | Duplicate identical requests |
|---|---|---|---|---|
| Cold load, signed out | 0 / 0 | 1 | 72 (about 1.4 MB over the wire) | 0 |
| Sign-in to Flow | 20 / 20 | 3 | 13 | 0 |
| Reload, signed in | 20 / 22 | 3 | 82 | 1 (`POST savings_accounts` twice) |
| Tab Accounts | 1 / 1 | 2 | 0 | 0 |
| Tab Wealth, Debts | 0 / 0 | 2 each | 0 | 0 |
| Tab Flow, back to Flow | 1 / 1 | 2 each | 0 | 0 |
| Reports | 0 / 0 | 2 | 5 | 0 |
| Save expense | 1 / 1 | 0 | 0 | 0 |

Sign-in to Flow, endpoints (each once unless noted): `POST /api/auth/check-email`, `POST /auth/v1/token`, `POST /api/auth/device/check`, `GET /api/flags`, `GET /api/rates`, `GET /api/gold`, `POST /api/auth/welcome`, `POST rpc/sync_pull_v2` (**2**), `GET profiles`, `GET /api/ai`, `GET /api/notifications`, `GET /api/savings/carry`, `GET /api/entitlements/me`, `GET sms_parse_log`, `GET asset_prices`, `POST rpc/sync_changed_since`, `POST /api/prices/refresh`, `POST /api/entitlements/trial`, `POST rpc/loyalty_week_summary`. The two `sync_pull_v2` calls differ in body, so the duplicate counter does not flag them. Large user's response to `sync_pull_v2`: about 150 KB (small user: under 15 KB for the whole step).

Reload, signed in (no user edit): `rpc/sync_pull_v2` x3, `rpc/sync_changed_since` x3, and writes `POST expenses` x1, `profiles` x1, `savings_accounts` x2, `user_settings` x1 (large user only).

Tab Accounts runs `rpc/latest_balance_reports` once. No other tab switch makes a data request.

## 6. Database: `EXPLAIN` (no ANALYZE), one at a time, live DB, large user's id

Table sizes at the time: `expenses` about 3,770 rows (3,000 are the synthetic user's). Statistics are fresh from the seed.

| Query (source) | Plan | Seq scan? |
|---|---|---|
| `select * from expenses where user_id=U and deleted_at is null` (full pull inside `sync_table_delta`) | Seq Scan, cost 124.9, est. 2,976 of about 3,770 rows | **Yes.** Indexes `idx_expenses_live`, `idx_expenses_live_user_id` exist; the planner chose a scan because the user holds about 80% of the table. |
| `exists (select 1 from expenses where user_id=U and updated_at > now()-'1 day')` (per-table probe in `sync_changed_since`, runs for 21 tables) | Seq Scan, cost 153.6 | **Yes.** No index on `(user_id, updated_at)` exists on `expenses` (index list from `pg_indexes`). |
| `count(*)` of `expenses` for a week by `user_id` + `expense_date` (`loyalty_week_summary`) | Index Scan `idx_expenses_user_date` | No |
| `latest_balance_reports` window query | Bitmap Index Scan `idx_balance_reports_latest` | No |
| `count(*)` of `sms_parse_log` with `awaiting_confirmation` last 16 days (`loyalty_week_summary`) | Index Scan `sms_parse_log_user_received_idx` | No |

Not run: `EXPLAIN` of the remaining 20 per-table probes and of the `profiles`, `asset_prices` reads (small tables). `sms_parse_log` has 55 indexes listed by `pg_indexes` (`indexname` list in this session's query).

## 7. Deferred tickets (QA-78, 80, 81) against their triggers

- **QA-78** (trigger: any account above about 300 rows in one cycle): the large user has about 250 rows per month. Flow tab switch 1,413 ms and back to Flow 1,323 ms (long tasks 184 to 262 ms) versus 689 ms and 411 ms for the small user. Below the trigger.
- **QA-80** (every route ships about 1.3 MB): measured 1,259 to 1,366 KB gzip on `/flow`, `/legal/terms`, `/offline`, `/install`, `/reset-password`, against 316 KB for marketing pages. Matches the ticket; not new.
- **QA-81** (trigger: about 5,000 expenses): 3,000 expenses is below it; localStorage size not measured (see Method).

## 8. Top 10 bottlenecks, ranked by measured cost

| # | Bottleneck | Measured cost | Evidence |
|---|---|---|---|
| 1 | Signed-out `/flow` (sign-in page) | Lighthouse perf 48, LCP 11,456 ms, TBT 1,360 ms, 1.52 MB, 77 requests; SEO 66. Marketing pages: LCP about 3,900 ms, 0.69 MB. | `lighthouse.json`, `bundle.json` |
| 2 | Sign-in click to shell | Small user median 11,973 ms (7,558 to 12,376); large user 6,207 ms. 20 data requests, several in sequence (`check-email`, `token`, `device/check`, `welcome`, then 2 `sync_pull_v2`). Not decomposed by request. | `journey-*-*.json`, `aggregate.md` |
| 3 | Reports screen | 2,964 / 3,213 ms to settle; long tasks 679 / 828 ms. Constant across users and with 0 data requests. | `aggregate.md` |
| 4 | Cold load, signed out | FCP 3,436 / 3,468 ms; 72 static requests, about 1.4 MB | `aggregate.md`, `journey-*-*.json` |
| 5 | Sign-in merge of a large store | Long tasks 2,751 ms (large) vs 825 ms (small); 150 KB sync response | `aggregate.md` |
| 6 | Reload with cached store | Large 4,274 ms to shell (FCP 2,992) vs 2,555 ms (small); 22 data requests incl. 3 `sync_pull_v2`, 3 `sync_changed_since`, 5 writes without a user edit | `aggregate.md`, `journey-large-*.json` |
| 7 | QA-84 first-paint commit burst | Median 236 total commits (122 to 506); up to 442 in one second at signed-out load (`OptionChip`, `FlowChipRow`, category icon) | `commits-large-*.json` |
| 8 | Flow tab switch with 3,000 expenses | 1,413 ms (back to Flow 1,323 ms), long tasks 184 to 262 ms; small user 411 to 689 ms | `aggregate.md` |
| 9 | Add-expense sheet open | 1,407 / 1,634 ms median | `aggregate.md` |
| 10 | Save expense with 3,000 expenses | 1,014 ms to close vs 604 ms (small) | `aggregate.md` |

Also measured: Sentry posts 2 envelopes on every tab switch and Reports visit (the only network activity of tabs Wealth, Debts, Reports); `/legal`, `/offline`, `/install`, `/reset-password` carry the full app bundle (1.26 to 1.37 MB gzip).

## 9. Recommendations

1. Investigate the signed-out `/flow` page (item 1): LCP element and the 1.28 MB JS it loads against 316 KB on marketing pages; SEO 66 failures are in `lh/signin_flow_signed_out_.json`.
2. Trace the sign-in sequence request by request (item 2) and the second `sync_pull_v2`; the run spread (7.6 to 12.4 s for the same user) needs its own measurement.
3. Reports: re-measure with chart animation off (QA-82) to separate animation from data cost.
4. Reload: find the source of the writes with no edit, the duplicate `savings_accounts` upsert, and the 3 pulls plus 3 `sync_changed_since` calls.
5. QA-84: the commit burst is before sign-in, on the signed-out page. It does not meet the close criterion as stated; either change the criterion to commits after sign-in (8 to 14) or reopen with the components in section 2.
6. Database: add `(user_id, updated_at)` indexes where `sync_changed_since` probes; `expenses` currently seq-scans that probe. Re-run the two seq-scan EXPLAINs once `expenses` holds more users.
7. Move `/legal`, `/offline`, `/install`, `/reset-password` out of the shell layout (QA-80 step 1) if web traffic matters; measured cost is about 1 MB gzip per page.
8. Check what Sentry sends on each tab switch (2 envelopes per switch) and whether that is intended.
9. Keep QA-78, 80, 81 deferred: none crosses its trigger. Re-measure QA-81 with the real localStorage size.
