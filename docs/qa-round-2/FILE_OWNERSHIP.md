# QA Round 2 - File ownership, migrations, conflicts

Planning only. Companion to LEDGER.md. Batches run strictly in order B1, B2, B3, B4, B5, B6, B7, B8, B9, B10a, B10b, B10c, B11, B12; each ends with lint + tsc + tests + build (dummy Supabase env), diff audit, commit of OWN paths only (never `git add -A`), push dev + main.

DB rules (CLAUDE.md): migration -> apply with execute_sql (owner check-in before any money-table apply in B1) -> add the ledger row -> regenerate `src/lib/supabase/database.types.ts` from the live DB -> then code. Run a row-count SELECT before every destructive statement. Existing applied files are never renamed (Z8/Q10).

## 1. Migrations in application order (from 0197; last existing file is 0196)

| No. | Name | Batch | Contents (IDs) | Risk |
|---|---|---|---|---|
| 0197 | b1_qa2_backup_and_repair | B1 | qa2_backup_* tables; link the 21 unlinked debt-payment expenses (D1); re-attach income events hidden by deleted sources (L1/R3). Gold-conversion audit is a read-only SELECT report, no write | Medium: matching by debt_id+date+amount+pm |
| 0198 | b1_debt_payment_amount_units | B1 | debt_payments amount_in_debt_unit, original amount/currency columns + best-effort backfill (D2) | Medium |
| 0199 | b1_savings_rpc_hardening | B1 | deposit/withdraw/correct RPC currency, deleted_at, FOR UPDATE, balance_after, local-date param, idempotent replay, ownership checks on jsonb ids in debt/income/subscription RPCs (Q6/W8); adjust_pocket_balance lock + unique partial index (user_id, account_id, transfer_group_id) + sign check (W9); support for client no longer writing current_balance (W7) | High: money |
| 0200 | b1_sync_roundtrip_columns | B1 | expenses subcategory / category label / shared_plan_id (L11); savings_accounts target_amount, emoji, updated_at; goals cancelled status handling (W22) | Low |
| 0201 | b3_policy_and_grant_lockdown | B3 | drop sms_ingest_tokens UPDATE policy + revoke writes (Q2/N7); drop trusted_devices insert/update policies + revoke (C2/Q3); biometric_devices grants; revoke anon ALL and authenticated TRUNCATE/REFERENCES/TRIGGER on public tables (Q11/N25); revoke anon on get_sms_keyword_pool (N24); drop profiles/user_settings delete policies + column grants (Q19) | High: can break client paths |
| 0202 | b3_merchant_categories_hardening | B3 | trigger ownership check on sms_log_id, corroboration (N distinct users), reject NON_SPEND categories, per-user override table (I1/Q4); record_sms_template_signal ownership (Q16) | Medium |
| 0203 | b3_account_erasure_fks | B3 | delete 23 orphan sms_template_users, FKs on sms_template_users/email_log/sms_stats_outbox, recompute unique_user_count (C6/Q5) | Low |
| 0204 | b3_constraints_not_valid | B3 | amount>0 first (expenses, income_events, debt_payments), wide date window, NOT VALID only (Q8) | High: see LEDGER risk |
| 0205 | b3_link_column_fks | B3 | FKs on link columns, NOT VALID then VALIDATE (Q9) | Low |
| 0206 | b3_admin_permissions_and_analytics_bounds | B3 | split users.tools / notify permissions in role seeds (O4); analytics_touch caps, key length, api_rate_hit use (O10/C24) | Low |
| 0207 | b3_cleanup_cron_schedule | B3 | schedule cleanup_abandoned_anon_users and cleanup_expired_trusted_devices (Q7) | Medium: deletes anon users |
| 0208 | b3_two_factor_session_gate | B3 | session/2FA verification table + extension of private.app_client_gate (C1) | Highest: lockout risk |
| 0209 | b4_sms_retention_lifecycle | B4 | raw_body nullable; rewritten sms_retention() by class (7d rejected/OTP, 30d parsed to masked shape, 60d cap with alert, 180d for shapes seen <3x, push_result cleared, corpus floor of distinct users); periods + purge hold key in platform_settings; OTP masking helper; masking improvements for corpus (N2/N3/N13/N19/Q17/LF6/DT2/DT3); backfill purge ONLY after LF3 backfill finished | High: irreversible |
| 0210 | b4_sms_atomic_booking | B4 | RPC add_sms_debt_payment_with_expense idempotent on sms_log_id with overpay check and status settle (D8/D21/N11); partial unique indexes on expenses/income_events sms_log_id exempting fee rows (N11/Q18) | High |
| 0211 | b4_sms_function_fixes_and_pattern_review | B4 | quarantine needs N hard signals from >=2 users (N16); sms_try_pair registered-sibling ambiguity (N22); sms_heal_stuck catch-all (N26); sms_parse_today per user zone (N27); cron.schedule for harvestLegacySms (LF3); table sms_pattern_reviews (status, notes, reviewer, period, pack generated_at) + RLS service-only (PR1) | Medium |
| 0212 | b5_budget_closed_cycles_sync | B5 | persist closed cycles server-side (R18) | Low |
| 0213 | b6_push_token_housekeeping | B6 | stale push token sweeper in housekeeping (O17) | Low |
| 0214 | b6_sms_disclosure_consent (optional) | B6 | user_settings.sms_consent_at (DT1) | Low |
| 0215 | b8_perf_indexes_and_publication | B8 | (user_id,id) live indexes, sms_parse_log partial index, drop sms_parse_log from supabase_realtime after confirming no subscriber, legacy analytics policy drop, analytics_touch tuning keeping O10 caps, api_rate_hit cleanup to cron (F8/F9/F11/F13/Q12) | Medium |
| 0216 | b8_app_client_gate_fast | B8 | plain-SQL gate, must keep min_app_version + C1 2FA check (F10) | High; separate file for revert |
| 0217 | b9_week_start_setting | B9 | user_settings.week_start nullable (T8) | Low |
| 0218 | b10c_dead_db_objects | B10c | drop ai_tmp_probe, duplicate income_sources updated_at trigger, drifted unused RPCs after D8 chose its RPC, dead tables only after row-count SELECT (Q13/D22) | Low |
| 0219 | b11_updated_at_triggers | B11 | missing set_updated_at triggers (Q14) | Low |
| 0220 | b11_sync_pull_needs_full | B11 | needs_full when cursor older than 60 days, per-table paging (Q15) | Medium |

No migration: B2, B7 (ledger repair for Q10 is execute_sql into the migration ledger), B10a, B10b, B12.

## 2. Main files per batch

- **B1** src/lib/utils/calculations.ts, currency.ts, calculations tests; src/lib/store/useFinanceStore.ts, store/types.ts; src/lib/supabase/remote/sync.ts, rpc.ts, mappers/{debtPayment,expense,savingsAccount,savingsTransaction,goal}Mapper.ts; src/lib/accounts/balance.ts; src/lib/debts/*, computeCreditCardBalance.ts, recurringDebtDueHandlers.ts; src/lib/budget/{lineEdit,monthClose}.ts, src/hooks/useBudgetPageActions.ts; src/lib/savings/*, wealth/zakatInputs.ts, wealthModel.ts, netWorth.ts, goals/*; src/hooks/useRecurringSavingsScheduler.ts; src/app/api/cron/month-carry/route.ts, lib/server allocateGoalFunding.ts; src/lib/buddgy/tools/exec/{wealthKit,debts,savings}.ts, lib/ai/aiActionHandlers.ts (delete_income only); src/hooks/useDebtTabData.ts (D2/D7), useAddDebtSheet.ts (D3 payment path); migrations 0197-0200.
- **B2** src/lib/ui/amountSanitize.ts (+ new shared parser), lib/utils/formatters.ts (T1/T6); src/components/modals/{AmountReceivedSheet,EditIncomeEventSheet,IncomeSheetForm}.tsx; src/components/features/savings-v3/{WithdrawSheetV3,AddSavingsSheetV3,ZakatSheet}.tsx, lib/savings/hawl.ts; src/components/features/debts/{PayDebtForm,DebtPaymentsFeed,PaymentMethodSetupSheet}.tsx; NotificationInbox.tsx; src/hooks/{useAddDebtSheet,useEditExpenseForm,useAddExpenseSheet}.ts; recurringDebtDueHandlers.ts; useFinanceStore.ts (deleteDebtPayment, deleteIncomeEvent, deleteSavingsAccount); src/components/receipt/*, lib/receipt/normaliseReceipt.ts, app/api/receipt/scan/route.ts; ExpenseSheetForm (receipt link); src/lib/ai/aiActionHandlers.ts, lib/buddgy/tools/exec/expenses.ts, hooks/useBuddgyChat.ts; flow/useFlowLedger.tsx (onDelete undo). Reused: CurrencySheet, ConfirmDialog/ActionToast Undo, EmptyState not touched.
- **B3** supabase migrations 0201-0208; src/app/api/auth/**, api/biometric/**, api/devices/**, api/account/**; src/hooks/{useAuthModal,useProfilePage}.ts, components/auth/AuthProvider.tsx, app/reset-password/confirm/page.tsx; settings hub SecurityCard.tsx, DataCard.tsx; src/lib/server/{userData,deleteAccount}.ts, api/admin/users/[id]/export; android/app/src/main/AndroidManifest.xml (+ new xml/data_extraction_rules.xml, backup rules); src/lib/crash/{init,scrub}.ts; src/lib/auth/resolveDeviceId.ts; src/lib/utils/formatters.ts (escapeCsvField); src/app/api/admin/{emails,staff,users,plans,platform}/route.ts, lib/email/{safeHtml,validate}.ts, api/auth/email-hook; src/lib/sms/merchantCategoryCache.ts (not parse route).
- **B4** src/app/api/sms/** (parse/route.ts, confirm, undo, health, setup-token), src/lib/sms/** (dispatch, pairing, createSmsExpense, templateApply, patterns/index.ts, adjudicator, skeleton, harvest, runAdjudication, preFilter, ingestGuards, correctionExemplar), new normaliser + replay harness (LF1/LF5), learner gates; android SmsReceiver.kt, SmsForwardWorker.kt, PendingSmsQueue.kt, SmsCapacitorPlugin.kt; ios SmsCapacitorPlugin.swift, CatchBankSmsIntent; src/lib/native/smsTracker.ts; admin: new views/PatternReviewView.tsx wired in adminRouter.ts/AdminApp.tsx/AdminShell.tsx nav, reusing ui/{Panel,DataTable,Kpi,Pill,Field,AdminSheet,StepUp}, useAdminAction/adminClient, smsDisplay.ts, SmsView.tsx tab pattern (coverage view LF4 as a tab), new api/admin/sms/pattern-review route (sms.view/sms.manage); migrations 0209-0211.
- **B5** src/hooks/{useReportsPage,useFlowBand,useCycleAwareMonth,useMonthClose,useNotifications}.ts, useMonthlyStats.ts (definitions only); src/lib/budget/**, lib/utils/calculations.ts (stats definitions), lib/income/paydayResolution.ts; flow/{FlowMonthRow,useFlowBand}.tsx, reports/*, MonthlyChart/CategoryPieChart; WidgetSync.tsx; lib/buddgy/tools/exec/reports.ts, buddgy client context, lib/ai/runAiCommand.ts, AddSavingsSheetV3 (left-to-spend wording); useDebtTabData.ts (D15); useSettingsStore.ts (monthFilter).
- **B6** ios/App/App.xcodeproj/project.pbxproj, Info.plist, Package.swift, AppDelegate.swift, PrivacyInfo.xcprivacy, debug/release xcconfig, entitlements; android AndroidManifest.xml, build.gradle/variables, MainActivity, DocumentScannerPlugin.kt, file_paths.xml; capacitor.config.ts, scripts/capacitor-build.mjs; src/lib/native/{pushNotifications,biometricAuth,socialSignIn,deviceId}.ts, NativeBootstrap.tsx, AppShell.tsx listeners, AndroidBackHandler; settings hub HelpCard/SupportBoardSheet/SupportInboxSheet; src/hooks/useAssetPrices.ts (V2/V16), safeLocalStorage.ts; DialogProvider.tsx, CardActionMenu.tsx (back guards); cron/notifications/route.ts, lib/notifications/evaluateAlerts.ts, vercel.json, api/health/deep, lib/server/cronAuth.ts; legal privacy sections; SMS consent screen (components/onboarding/sms). Quick-add lookbehind files lib/buddgy/local/*.
- **B7** package.json/package-lock.json, .github/workflows/ci.yml, .github/dependabot.yml, vitest.config.ts, tsconfig.json, eslint.config.mjs (untouched), .gitignore, .vercelignore, .nvmrc/engines, scripts/native-release.sh (trap only), env docs + src/lib/env.ts, next.config.ts, new tests under src/**/__tests__.
- **B8** src/components/layout/AppViewRouter.tsx (no whole-view lazy), ModalProvider.tsx (sheets via next/dynamic), AppShell.tsx, app/layout.tsx, globals fonts, lib/store/useFinanceStore.ts (persist, zod import), safeLocalStorage.ts, lib/utils/calculations.ts (filterExpensesByMonth), monthlyStats.ts, hooks/useMonthlyStats.ts (+ shared memo), sync.ts (keyset paging), sheets with whole-store subscriptions (EditExpenseSheet, EditIncomeSheet, LifestyleSheet, HouseholdRentSheet, QuickActions, BottomNav, QuickAddFAB), PlanHistoryPage.tsx, useReportsPage.ts, public/ images, legal/offline route group; migrations 0215-0216.
- **B9** src/lib/i18n/{en,ar}.ts + new arPlural, useLocalizedFormatters.ts, lib/utils/formatters.ts, currency.ts (compact suffix), globals.css (ar letter-spacing), UnifiedDatePicker.tsx, expenses/dateRange.ts, useSettingsStore + settings UI week start, voice/receipt/savings-v3/onboarding-sms/reports/error pages translations, hooks error strings, server notifications (cron/month-carry, devices/registry, webhooks/linear), settings rows un-mirrored (X14), offline/page.tsx, PayCycleSheet/CurrencyDualSheet COPY tables; migration 0217. Skip files on the B10c delete list.
- **B10a** globals.css + tailwind tokens (focus ring, z-index scale, chip tokens, reduced motion), ui/{Button,IconButton,Input,Switch,ActionToast}.tsx, ModalShell.tsx, sheets' hand-rolled titles (useModalTitleId), BottomNav.tsx, DesktopHeaderBar/Sidebar/legal layout (X4), PaydayTimeline, AmountReceivedSheet colours, AuthFormErrorAlert, ExpenseDayList colours, Notification buttons, form error roles, h1 per page, expense/income edit Delete button (L20).
- **B10b** ui/ModalSheetHeader (additive variants), V3SheetHeader, SheetTitleBar, ~22 hand-rolled sheets (step 2 separate), CurrencySheet/CurrencyDualSheet/CurrencyList, DatePickerField call sites (AssetFormSheet, PocketFormSheet, ExpenseSheetForm), SettingsToggleRow/SettingsSwitchRow, ui/EmptyState + six bespoke empties, AuthPasswordField + reset-password page, Badge/StatusPill, MoneySheetParts + Income/Assign/AmountReceived/Move/Update/Add/Withdraw sheets, debts BorrowHeroCard/CreditCardHeroCard/InstallmentHeroCard/heroCardShared + FlowSummaryBand via HeroBand (LAST).
- **B10c** delete the 11 dead components + 7 dead shadcn primitives + dead exports (not ReceiptDetailSheet), lib/native/notificationParser.ts, budget/cashflow.ts, legal/income/expenses re-export routes (after link check), rpc.ts dead wrappers, migration 0218.
- **B11** per-area sweep files (ledger L7/L19, wealth W23-W29, debt D23-D28, AI I3-I24 incl. usePendingAiJobs/PendingCapturesChip, voice/transcribe, receipt scan route limits, ai gateway, ops O13/O15/O16, X-items, copy U46-U50, C10 privacy mask surfaces, Q14/Q15 migrations 0219-0220, useAssetPrices W19/X9, not-found/error pages X11).
- **B12** docs/ (CLAUDE_CONTEXT.md, DESIGN_SYSTEM.md notes, round-3 backlog, Play/App Store checklist), no source.

## 3. Files touched by more than one batch: conflict risk and safe order

Order is always ascending batch number (the plan order); the notes say what each later batch must preserve.

| File / area | Batches | Risk | Safe ordering / rule |
|---|---|---|---|
| src/lib/store/useFinanceStore.ts | B1, B2, B5, B8, B11 | High (2100 lines, parallel sessions) | B1 money logic first; B2 delete/undo actions after; B8 persist/zod import last of the structural edits. Edit by function, run store tests each time |
| src/lib/utils/calculations.ts | B1, B5, B8 | High | B1 (L1, R11 day semantics, L23, D16); B5 stats definitions (R4/R5); B8 F4 string-key rewrite must reuse B1's day rule |
| src/lib/utils/formatters.ts | B2, B3, B5, B9 | Medium | B2 T1/T6; B3 escapeCsvField; B5 BOM/export helper; B9 locale/symbol |
| src/lib/utils/currency.ts | B1, B9 | Low | B1 XAU rule first; B9 compact suffix |
| src/lib/supabase/remote/sync.ts | B1, B8, B11 | High | B1 (L3, W7) then B8 keyset paging then B11 needs_full |
| src/lib/supabase/database.types.ts | B1, B3, B4, B5, B6, B8, B9, B10c, B11 | Medium | Regenerate from live DB after each apply; never hand-merge |
| src/lib/i18n/en.ts, ar.ts | B2, B4, B6, B9, B11 (and B10b labels) | Medium | Append keys per batch; B9 bulk work after the others; keep en/ar key parity test green |
| src/hooks/useAddDebtSheet.ts | B1 (D3), B2 (D6, D9, D11) | Medium | B1 then B2 |
| src/hooks/useDebtTabData.ts | B1 (D2, D7), B5 (D15), B9 (T5 dates) | Medium | B1, B5, B9 |
| lib/ai/aiActionHandlers.ts | B1 (delete_income), B2 (I6-I8) | Low | B1 then B2 |
| lib/buddgy/tools/exec/* | B1, B2, B5, B11 | Medium | B1 conversions, B2 add_expense guard, B5 get_summary left-to-spend, B11 privacy mask |
| src/hooks/useFlowLedger.tsx, flow/useFlowBand.ts, FlowMonthRow.tsx | B2, B5, B9, B11 | Medium | B2 undo, B5 band/nav, B9 locale, B11 L7/L19 |
| src/hooks/useReportsPage.ts | B5, B8, B9 | Medium | B5, B8 memoisation, B9 localisation |
| src/lib/store/useSettingsStore.ts, store/types.ts | B1, B5, B6, B8, B9 | Medium | Additive fields only; B9 weekStart last |
| src/components/features/savings-v3/ (WithdrawSheetV3, ZakatSheet, PocketFormSheet, AssetFormSheet) | B2, B9, B10b, B11 | Medium | B2 logic, B9 strings, B10b header/date picker |
| src/components/modals/AmountReceivedSheet.tsx | B2, B10a, B10b | Medium | B2 parser, B10a colours, B10b MoneySheetParts |
| src/components/receipt/* | B2, B9 | Low | B2 wiring/guards, B9 strings (ReceiptDetailSheet translated in B2) |
| src/app/api/sms/parse/route.ts | B3 (none: I1 prompt escape moved), B4 | Low | I1 prompt escape and I22/N31 done in B4 only |
| src/lib/sms/createSmsExpense.ts | B1 (none; D2 SMS path moved), B4 | Low | D2 SMS write path done in B4 with D8 |
| SMS native (SmsReceiver.kt, SmsForwardWorker.kt, SmsCapacitorPlugin.kt/.swift, smsTracker.ts) | B4, B6 | Medium | B4 gate/queue/idempotency; B6 V7 secure storage after |
| android AndroidManifest.xml | B3 (allowBackup), B6 (READ_SMS, BootReceiver, minWebView, speech-recognition) | Medium | B3 then B6; rebase B6 edits on B3's rules files |
| src/components/auth/AuthProvider.tsx, hooks/useAuthModal.ts | B3, B6, B9 | Medium | B3 sign-out/2FA, B6 V9/C21 lock, B9 strings |
| settings hub cards (SecurityCard, DataCard, HelpCard, BalancePrivacyCard, SettingsToggleRow) | B3, B6, B9, B10b, B11 | Low | ascending |
| private.app_client_gate (DB function) | B3 (0208 C1), B8 (0216 F10) | High | F10 must keep the C1 check and version gate; test both |
| app_analytics / analytics_touch (DB) | B3 (0206), B8 (0215) | Low | B8 keeps O10 caps |
| sms_retention() and corpus functions (DB) | B4 (0209, 0211) | Medium | purge backfill after LF3 backfill |
| cron/month-carry/route.ts | B1 (W13-W15), B9 (T12 strings) | Low | B1 then B9 |
| cron/notifications + evaluateAlerts | B6 | Low | single batch (B9 T12 only touches month-carry/registry/linear) |
| src/app/layout.tsx, globals.css | B8 (F3/F16/X8), B9 (T10), B10a (tokens) | Medium | B8, B9, B10a; keep CSP nonce script intact |
| ModalShell.tsx and ~60 sheets | B2, B8 (F7 mount-on-active), B9, B10a, B10b, B10c | High (widest file set) | Logic first (B2), perf (B8), strings (B9), a11y names (B10a), header merge (B10b) |
| package.json / lockfile / ios+android native projects | B6 (V22), B7 (Z1/Z14/Z15) | Medium | B6 first; B7 Capacitor bump then re-sync native files; no native build unless owner asks |
| middleware.ts / next.config.ts | B3 (if C1 needs it), B7 (Z19), B8 (F3) | Low | B3, B7, B8 |
| BottomNav.tsx | B8 (F7), B10a (U40) | Low | B8 then B10a |
| useAssetPrices.ts | B6, B11 | Low | B6 then B11 |
| Admin SMS views (SmsView, adminRouter, smsDisplay) | B4 (LF4, PR1), B3 (O-items touch other views) | Low | B3 admin routes do not touch SMS views |

Cross-batch ordering constraints (must hold):
1. R11 (B1) before F4 (B8). I8 (B2) and D6/L16/L17 before Q8 constraints (B3).
2. C1/0208 (B3) before F10/0216 (B8).
3. LF1/N5 normaliser and LF3 backfill + LF6 masking before the N2 backfill purge (B4).
4. B9 skips files B10c will delete (IosSmsSetupClient, RecurringIncomeCard, ProfilePersonalDetailsSection, CategoryBar etc.); B10a/B2 do too.
5. B9 moves CurrencyDualSheet/PayCycleSheet COPY into dictionaries before B10b merges the sheets; B10a gives sheets accessible names before B10b replaces headers.
6. D22/0218 (B10c) after D8/0210 (B4) decided the surviving debt-payment RPC.
7. U8 debt cards last inside B10b, pixel-identical with before/after screenshots.
