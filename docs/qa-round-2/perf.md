# QA2 PERFORMANCE report (read-only; probes deleted; .next rebuilt with dummy env, git status clean apart from other agents' qa2 probes)

Method: `npm run build` (webpack) + chunk analysis of .next; vitest probe with 20k synthetic expenses (deleted); live DB SELECT-only (pg_stat_statements, advisors, pg_policies, cron.job, publication); code reads.
Benchmark (Node, desktop CPU; WebView on mid phone is typically 3-6x slower):
| op | 2k exp | 20k exp |
| computeMonthlyStats | 23-42 ms | 213-335 ms |
|   of which filterExpensesByMonth alone | - | 85-179 ms (called 2x per run) |
| JSON.stringify(expenses) | 2-5 ms | 30-58 ms (7.5 MB, 376 B/row) |
| JSON.parse | 4-5 ms | 39-45 ms |
| diffLists, rows deep-equal but new refs | 4-9 ms | 35-38 ms |
| diffLists same refs | 1-2 ms | 7-25 ms |
| computeBalances | 10-27 ms | 11-21 ms (fine) |
| calculateCategorySpending (all rows) | - | 6-11 ms |
Build: 122 JS chunks, 6.9 MB raw / 2.02 MB gzip total. Next 16 webpack build prints no size table, so sizes taken from the client reference manifests.

## Findings

F1 P1 - Every route ships the whole app: ~3.0 MB raw / ~910 KB gz JS on first load, even /offline and /legal/privacy
- src/components/layout/AppViewRouter.tsx:6-27 (21 pages statically imported on purpose), AppShell.tsx (37 imports; 13 sheets in ModalProvider), app/layout.tsx.
- Measured from .next/server/app/*/page_client-reference-manifest.js: /flow 3028 KB raw/911 gz, /wealth 3051/920, /reports 3055/919, /goals 3094/934, /legal/privacy 3031/912, /offline 3028/911, /admin 3795/1119. Page-specific part is <100 KB; the layout chunk alone is 642 KB raw (app/layout-*.js). Largest shared chunks: 538 KB (2926), 449 KB (6482), 313 KB (288, recharts), 241, 204 (supabase), 201, 191 (sentry+supabase), 190 (framework), 177 (sentry), 127 (zod).
- Impact: ~0.9 MB gz parse on every cold start; at 3G/4G-slow (1.6 Mbps) ~4.5 s transfer, plus 300-800 ms parse/compile on mid phones. Native builds ship it locally so mainly a web/PWA cost, but parse/compile and memory still hit the WebView.
- Fix: keep the synchronous shell for hot tabs (flow, wealth, accounts) but lazy-import the cold ones (reports, goals, budget-setup, settings/*, budget-history, notifications, start) and the 13 modals behind `activeModal` (next/dynamic). Keep the wedge-safe guarantee by prefetching idle (`requestIdleCallback`) so navigation stays synchronous after warm-up.

F2 P2 - zod (127 KB raw, chunk 5998) is in the main bundle only for the import-JSON feature
- src/lib/store/useFinanceStore.ts:11 imports `importDataSchema` from financeImportSchema.ts (zod). src/lib/ai/gemini.ts also imports zod and is imported client-side by AIChatBubble.tsx:7 (`checkAIStatus`) and runAiCommand.ts.
- Impact: ~127 KB raw (~35 KB gz) on every route for rarely used code.
- Fix: dynamic `import('./financeImportSchema')` inside importData; split `checkAIStatus` out of gemini.ts.

F3 P2 - Root layout reads `headers()` (CSP nonce), so ALL 100+ pages are dynamic (build table shows no static page except robots/sitemap)
- src/app/layout.tsx:131-132; static pages /legal/privacy, /legal/terms, /terms, /privacy, /offline, /_not-found render per request on a serverless function; no CDN cache of HTML. /offline is the PWA fallback document, so the offline shell itself requires a function invocation while online-but-flaky.
- Fix: move legal/offline to a route group with a layout without headers() (nonce-less CSP with hashes for the single inline theme script), or compute nonce only for authenticated shells.

F4 P1 - filterExpensesByMonth uses date-fns parseISO + isWithinInterval per row: 85-179 ms per 20k rows, and it runs 2x inside computeMonthlyStats (monthlyStats.ts:115 and calculations.ts:541 via calculateLeftToSpendCashFlow)
- src/lib/utils/calculations.ts:97-110. Also called per-month in loops: lineSpend.ts:127 lineHistory (HISTORY_CYCLES x full scan), factsFromStore.ts:91 (AVERAGE_CYCLES x full scan), fundingBasis.ts:48 (3 x), PlanHistoryPage.tsx:71 (per card, each render, not memoised), WidgetSync.tsx:46, useMonthClose.ts:57, goals/computeGoalProgress.ts:52.
- Impact (20k rows): computeMonthlyStats 213-335 ms per recompute; budget history / plan studio add 3-6 more 100 ms scans each. At 2k rows (~6 months of a heavy SMS user) it is 23-42 ms. Phone estimate at 20k: 0.7-1.5 s main-thread freeze per expense write.
- Fix: compare `e.date.slice(0,10)` strings against precomputed start/end ISO keys (expected <2 ms per 20k) or pre-bucket expenses by cycle key in a memoised index shared by all callers.

F5 P1 - computeMonthlyStats runs once per hook instance: 2-4 identical full recomputations per route, on every change to any input slice
- src/hooks/useMonthlyStats.ts (own useMemo per caller). /wealth: page useMonthlyStats + useNetWorth->useMonthlyStats (2x); /flow: page + useFlowBand + useFlowBand->useNetWorth (3x); /reports: page + ReportsNetWorthPanel->useNetWorth (2x); 24 call sites of useMonthlyStats/useNetWorth/useAccounts/useLedgerInput overall. useAccounts and useNetWorth each also call computeBalances separately via useLedgerInput (cheap, 11-21 ms).
- Impact: with F4, /flow at 20k rows = ~3 x 213-335 = 0.65-1.0 s (desktop) per expense add/edit; also fires when `exchangeRates` ticks (useRates) since it is an input.
- Fix: one memoised selector (module-level cache keyed by input refs, like countedDebts already does) or a context provider computing stats once per month filter.

F6 P2 - Persistence: zustand persist has no partialize/throttle; every set() re-serialises the whole finance store to localStorage synchronously
- src/lib/store/useFinanceStore.ts:173 (persist), 2116 (createJSONStorage), no `partialize` anywhere in that file; safeLocalStorage.ts:25-30.
- Measured: 376 B per expense; 2k rows = 752 KB, 20k rows = 7.5 MB JSON. JSON.stringify 30-58 ms per write at 20k plus localStorage.setItem of 7.5 MB (blocking). Any set() (rates tick, dataReady flag, a toggle) pays it. Boot adds JSON.parse 40-45 ms.
- Quota: WebView localStorage ~5 MB (5M chars) -> overflow at ~13k expenses (before other slices; a heavy SMS user at ~10/day reaches it in ~3.5 years, an import/long-history user sooner). On QuotaExceededError safeLocalStorage silently falls back to an in-memory Map: the persisted cache goes stale with no warning, next launch loads the old blob (cache-first boot shows missing recent data until pull).
- Fix: partialize out transient (exchangeRates, flags, dataReady), debounce writes (250-500 ms), and move large ledgers to IndexedDB/Capacitor Filesystem; surface quota failure to Sentry.

F7 P2 - Whole-store subscriptions in permanently-mounted sheets
- `useFinanceStore()` with no selector: EditExpenseSheet.tsx:9, EditIncomeSheet.tsx:8, LifestyleSheet.tsx:25, HouseholdRentSheet.tsx:25 (all mounted by ModalProvider on every screen), plus QuickActions.tsx:155, useSettingsPage.ts:27, useProfilePage.ts:26, useAddDebtSheet.ts:48, accounts/page.tsx:59 (`useFinanceStore((s) => s)`). `useSettingsStore()` whole-store destructuring in 19 places incl. BottomNav.tsx:24, QuickAddFAB.tsx:33, ModalProvider and 13 sheets.
- Impact: each finance write / rates tick re-renders at least 4 hidden sheets + accounts page; EditExpenseSheet also runs `expenses.find` O(n) on each render (20k: sub-ms but wasteful). BottomNav and FAB re-render on every settings-store change.
- Fix: selectors (`useFinanceStore(s => s.expenses)`), mount sheet bodies only when `activeModal` matches.

F8 P2 - pullAll pages serially, 1000 rows/page, `select('*')`, offset pagination ordered by id with no (user_id,id) index
- src/lib/supabase/remote/sync.ts:281-310 fetchLive; 23 tables in parallel but each table's pages are sequential. 
- Impact: 20k expenses = 20 sequential round trips; Vercel region sin1 and Supabase ap-southeast-1 are aligned (good) but a Cairo client has ~150-250 ms RTT => ~3-5 s extra cold pull; select('*') ships every column (SMS-derived text, notes); deep OFFSET (19000) forces the DB to walk and sort rows (idx_expenses_live is (user_id) partial, order by id needs a sort).
- Fix: keyset pagination (`id > last`), fetch pages for the biggest tables concurrently by count, add composite (user_id, id) WHERE deleted_at IS NULL indexes on expenses/income_events, select only needed columns. Delta path (pullDelta) was not benchmarked.

F9 P2 - Realtime change-feed still running for sms_parse_log although the app now uses broadcast nudges
- Live DB: publication supabase_realtime contains sms_parse_log (only). pg_stat_statements: the realtime `wal->>type ... ` poll query has 1,513,441 calls, 10,125,450 ms total (~2.8 h of DB time), mean 6.7 ms, max 14 s; pg_publication_tables lookup 25,446 calls / 506 s. AppShell.tsx:166 SmsNudgeSync comment says "No change-feed subscription".
- Impact: constant background DB load that exists only for the Realtime poller; steals CPU on a small instance and inflates tail latency.
- Fix: `ALTER PUBLICATION supabase_realtime DROP TABLE sms_parse_log` (after confirming no client subscribes) -- needs owner decision (DB write; not done).

F10 P2 - Every PostgREST request runs app_client_gate() as a pre-request hook at 35-60 ms mean
- pg_stat_statements: public.app_client_gate 7,222 calls mean 60.8 ms max 1,872 ms (439 s total) and 6,554 calls mean 35.2 ms (231 s); after the 0195 move, private.app_client_gate 230 calls mean 48.7 ms max 446 ms, 68 calls mean 55 ms. It is plpgsql SECURITY DEFINER STABLE reading request.headers + platform_settings + app_version_below(); for a web request without x-app-platform it should return early in microseconds, so the cost is dominated by function-call/permission overhead and shared-CPU contention.
- Impact: adds ~35-60 ms to the latency of EVERY REST/RPC call (sync flush, pull, rpc), i.e. more than a quarter of a typical 150 ms call.
- Fix: make it `LANGUAGE sql STABLE`/cache `min_app_version` in a GUC or a tiny table read, avoid SECURITY DEFINER, or only enforce on mutating endpoints.

F11 P2 - Admin/analytics cron jobs are heavy relative to data size
- cron.job: admin-metrics `*/15` -> admin_refresh_metrics mean 500 ms (681 calls, 341 s, max 5.6 s); sms-heal-stuck `*/5` mean 127 ms (2,124 calls, 270 s); sms-stats-drain `*/5`. Total DB tables are < 2 MB (largest sms_parse_log 1.77 MB, 859 rows) so 127 ms for the heal sweep on 859 rows implies a seq scan with a non-sargable predicate (sms_parse_log seq_scan 3,379, 1.49 M tuples read vs 60,202 idx scans).
- Fix: partial index on sms_parse_log (status, created_at) WHERE status IN ('processing','failed'); run admin-metrics hourly or incrementally.

F12 P3 - Index bloat / write amplification: expenses has 11 indexes (idx_expenses_user is redundant with idx_expenses_user_date and idx_expenses_live), sms_parse_log 13, income_events 7. Advisor lists 52 unused indexes (e.g. idx_expenses_receipt, idx_debts_live, idx_goals_live, idx_savings_holdings_live, sms_parse_log_merchant_norm_idx, profiles_name_trgm_idx, profiles_display_name_trgm_idx). Tables are tiny today so cost is negligible; becomes relevant at 100x. Do not drop yet (stats window short, also noted in D9).

F13 P3 - app_analytics_events: 26,094 historical single-row INSERTs via PostgREST, mean 59.8 ms, max 7.2 s (1,561 s total); policy with_check does a count(*) subquery over the same table per insert (migration 003). Client now uses analytics_touch RPC (AnalyticsHeartbeat.tsx, 2-min buffer, 543 calls mean 642 ms max 8.3 s!) -- analytics_touch mean 642 ms is slow for a one-row upsert per user per day; the legacy table is now empty (0 rows) but 3,373 seq scans / 397k tuples read. Fix: inspect analytics_touch (likely locks on app_analytics_daily or a paths jsonb merge), drop the legacy rate-limit policy.

F14 P3 - RLS policy cost is fine: 119 public policies, 0 with bare auth.uid()/auth.jwt()/auth.role() (all wrapped in (select ...)). Advisor shows no multiple-permissive / auth_rls_initplan warnings -- recorded as verified OK. Performance advisor only reports unused indexes (52).

F15 P3 - Images: public/subscription-icons holds 38 PNGs = 3.3 MB (substack.png 225 KB, chatgpt_plus.png 214 KB, avg 87 KB) rendered as ~40 px tiles via plain <img> (BrandTile.tsx:46); providers/ 776 KB (valu.png 263 KB, aman.png 203 KB); buddgy-square.png 482 KB, buddgy-cutout.png 324 KB; icon-512 199 KB. Capacitor build uses images: { unoptimized: true } so nothing resizes them. Fix: resize to 96x96 WebP (expect ~2 KB each, -3.2 MB) and convert Buddgy art to WebP.

F16 P3 - Fonts: 4 next/font/google families in root layout (DM_Sans x2 with 5+3 weights, JetBrains_Mono 3 weights, IBM_Plex_Sans_Arabic 5 weights = 16 weight files, layout.tsx:14-35), Arabic family preloaded by default for English users. Fix: `preload:false` on Arabic, load heading DM Sans as the same variable font (one file) and trim unused weights.

F17 P3 - Sync snapshot()/sliceRefs are shallow and cheap (verified: snapshot is a 23-field ref copy; subscribe listener bails when slice refs are equal), so no per-mutation diff storm. The remaining cost is flushDiff deepEqual over every row whose ref changed (35 ms/20k when all refs differ, e.g. after merge/applyDelta that rebuilds arrays) -- acceptable. Noting that mergeList/applyList are O(n) with Maps (no O(n^2) found in monthlyStats/netWorth/computeBalances/reports; scans are linear).

F18 P3 - Serverless config: maxDuration set on 8 heavy routes (sms/parse 60, receipt/scan 60, buddgy/turn 60, budget/ai 60, ai 30, voice 30, crons 60); vercel.json declares 3 crons (notifications, prices, integrations) but not month-carry (route exists, maxDuration 60) -- known B7 hold. vercel.json region sin1 only (single region); API cold start weight not measurable offline: server dir 14 MB, firebase-admin + groq-sdk + sentry are in the server graph of routes that need them only if imported lazily -- not verified per route.

F19 P3 - Caching headers: public routes have them (rates s-maxage 7200, gold 60-900, app-config 60, flags). /api/entitlements/me, /api/health set explicit headers. No immutable caching issue found on static assets (Next default). HTML never cached due to F3. next.config headers apply `X-XSS-Protection` etc to every asset including /_next/static (harmless).

F20 P3 - Lists/virtualisation: no windowing library; ExpenseDayList renders day groups for the whole month only (month filter bounds it, ~850 rows for a heavy month at 20k history), reports charts are dynamic()-imported (recharts is a 313 KB async chunk, good). Not measured in a browser.

## Counts
P0 0 | P1 3 (F1, F4, F5) | P2 8 (F2, F3, F6, F7, F8, F9, F10, F11) | P3 9 (F12-F20)

## Top 10
1 F1 whole app (~910 KB gz) on every route incl. /offline
2 F4 filterExpensesByMonth date-fns per-row, 85-179 ms/20k, called 2x+
3 F5 computeMonthlyStats recomputed 2-4x per route (213-335 ms each at 20k)
4 F6 persist writes 7.5 MB blob on every set, quota overflow ~13k rows silently falls to memory
5 F10 app_client_gate pre-request hook adds 35-60 ms to every REST call
6 F9 Realtime WAL poller on sms_parse_log: 1.5 M calls / 2.8 h DB time with no subscriber
7 F8 pullAll serial 1000-row offset pages, 20 round trips at 20k rows
8 F7 whole-store subscriptions in 13 permanently mounted sheets
9 F3 nonce in layout makes every page dynamic (legal/offline too)
10 F11 admin-metrics (500 ms) and sms-heal-stuck (127 ms) crons on a 1.7 MB table

## Not reached
Browser-measured LCP/INP/TBT and real render timing (no browser perf run); React Profiler re-render counts (inferred from code); API route N+1 audit beyond cron/notifications (per-user ~6-10 queries in batches, bounded, looks OK); sms/parse hot path latency; pullDelta cost; month-carry cron queries; Android/iOS WebView numbers; cold-start of serverless functions; EXPLAIN on slow queries (a pg_proc/pg_indexes query timed out once on the live DB, not retried); bundle contents of the two biggest chunks (2926: 538 KB, 6482: 449 KB) not attributed to packages.
