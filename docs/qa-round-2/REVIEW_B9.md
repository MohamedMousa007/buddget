# REVIEW B9 (i18n / week start / Arabic / glossary), read-only

No blockers found. Not run: lint/test/build; not checked: all hard-coded English left in Arabic (only spot checks).

## Medium
1. supabase/migrations/0217_b9_week_start.sql (UPDATE): backfills Saturday for every row with `timezone IS NULL`, so non-Gulf users whose zone was never reported (US/EU, older rows) are permanently pinned to Saturday as an explicit choice, and `resolveWeekStart` never reaches the device-zone default for them. Fix: leave NULL rows NULL (client already resolves via device zone), or backfill only the 8 Saturday zones.
2. src/app/globals.css:573 `unicode-bidi: plaintext` on p/label/td/li/span.block: per-element base direction means one list/column mixes right-aligned Arabic rows with left-aligned English rows (merchant names, notes) in the same `text-align:start` column. `.font-mono-numbers` correctly wins (zero specificity via :where), but any non-mono amount in a `td`/`span.block` whose first strong char is Arabic gets RTL ordering (e.g. "ج.م 500" or "- 500 جم" reorders). Fix: scope to prose containers or add `.num`/amount classes to the exclusion, verify Flow rows and tables in ar mode.
3. src/lib/i18n/dictionaries/ar.ts:251, 2121, 2123 `daysLeft`, `monthEndTitleDays`, `monthEndBodyDays`: arCount + "متبقية". Feminine plural agrees only for 3-10 ("أيام متبقية"). 1 gives "يوم واحد متبقية", 2 "يومين متبقية", 11+ "11 يومًا متبقية", all ungrammatical (need متبقٍ). Fix: use a per-count suffix or restructure ("المتبقي: 5 أيام").
4. src/components/modals/EditIncomeEventSheet.tsx:61 reuses `income.confirmDelete` ("Delete this income source? This can't be undone.") for deleting a single income event. Glossary rewording made the wrong noun a stronger permanent claim. Fix: add an event-specific string ("Delete this income entry?").

## Low
5. src/lib/i18n/arPlural.ts:15-22: CLDR `other` also covers 100-102 and fractions, so 101 renders "101 أيام" (should be "101 يوم"); negative n selects by |n| so -1 gives "يوم واحد". Also n=0 with `two`/`one` forms is fine. Fix: handle n%100===1/2 for n>=100, or document integer 0-99 only.
6. src/lib/utils/formatters.ts:74 duplicates the 3-decimal set already in src/lib/ui/amountParse.ts:13 (KWD/BHD/OMR/JOD/TND). Two sources of truth, will drift. Fix: export one `currencyDecimals` and use it in formatCurrency. Otherwise correct: negative check uses same maxDigits; no code parses displayed strings back; SMS/OMR detection uses ISO codes (not the 'RO' symbol), so the OR->RO change is safe.
7. src/lib/i18n/dateFormat.ts formatLocalized: invalid Date still throws RangeError from date-fns (pre-existing contract, now on a wider surface). MMM->MMMM regex does not skip quoted literals ('MMM'). Fine for current patterns.
8. src/app/global-error.tsx: no `data-locale` on <html>, so the Arabic font and bidi CSS don't apply to the Arabic root-error page; also a one-frame English flash before the effect reads storage (SSR-safe: readStoredLocale runs only in effect, try/catch ok). Offline page: 'use client' with no metadata export, no conflict; relies on LocaleProvider from (app) layout, present.
9. src/lib/server/userDictionary.ts + registry.ts/linear webhook/month-carry: one extra `user_settings` select per notification (month-carry already has `s`/dict per cycle, so no N+1 there). Errors ignored -> English fallback; acceptable. support_resolved `.slice(0,80)` can cut a surrogate pair. renderServerCopy interpolates user subject only as plain text, no injection path.
10. Week start sync: mapper sends only when set (ok), import schema accepts 0/1/6 (ok). Pull of NULL maps to `undefined`; if the object is spread over local state it clobbers a locally-chosen value before it has pushed. Verify the settings merge in sync.ts keeps local when remote is undefined. No way to return to "auto" once chosen. resolveRange, monthGrid (column = (day-ws+7)%7), weekdayColumns are correct for Sat/Mon; only 3 callers of the week preset, all pass weekStart.
11. SettingsRow: clean, no leftover props; chevron no longer flips (layout is LTR, consistent).

## Arabic spot-check (docs/ARABIC_REVIEW.md, ~45 rows)
No offensive or clearly wrong strings. Wording to confirm with the owner:
- "Pocket" = محفظة (glossary) collides with "Mobile wallet" = محفظة إلكترونية (savingsForms.pocketKinds.wallet): both read "wallet". Consider "جيب"/"وعاء ادخار" or keep and accept.
- pocketKinds.bank.sub "Current or savings" -> "جارٍ أو توفير": ambiguous (reads "in progress"); use "حساب جارٍ أو توفير".
- asset.coin "Coin" -> "العملة" duplicates Currency label; use "العملة الرقمية".
- savingsForms.identity.matures "matures" -> "يستحق" (is due); "ينتهي في"/"تاريخ الاستحقاق" clearer.
- memoryWords mixes genders ("مهتم" masc vs "لديك"/"تعول" neutral).
- voice.errors.noCatch "لم نسمع ذلك جيداً" ok; "voice.recap.redo" إعادة ok.
- Glossary "Delete" claim "can't be undone" is wrong wherever Undo exists (deleteBody keeps "You can undo", ok) but confirmDeleteExpense/expenses.confirmDelete have no call sites found in tsx; verify they are used and whether an undo toast follows expense deletes.
- dictionaryParity.test: checks keys/types and Arabic script presence only; function leaves are never invoked, so wrong arity or throwing templates (e.g. arCount with n undefined) are not caught. Add a smoke call with sample args.
