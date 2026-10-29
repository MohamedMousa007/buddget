# B11 adversarial review (uncommitted diff, read-only)

Severity: BLOCKER / HIGH / MED / LOW. Tests, lint and build were not run (read-only review).

## BLOCKER

1. **sync_pull_v2 client ships before the migration is applied.** `src/lib/supabase/remote/delta.ts` (`pullDelta`) now calls only `sync_pull_v2`. `supabase/migrations/0220_b11_sync_pull_needs_full.sql` is marked "NOT YET APPLIED" (0219 too). Any build or web deploy that precedes the apply makes every pull throw "function not found", so sync stops for all users. Fix: apply 0219 and 0220 first (CLAUDE.md DB-first rule). Optionally fall back to `sync_pull` on a missing-function error.

## HIGH

2. **Recurring savings month-end anchor does not survive persistence.** `src/lib/savings/recurringDue.ts:5-18`, `src/hooks/useRecurringSavingsScheduler.ts:28-36`. `anchorDay` is read from the `nextDueDate` passed in, and only the clamped `next` is persisted. Jan 31 with today Feb 10 gives next = Feb 28. On the next tick the anchor is 28, so the schedule becomes Mar 28, Apr 28 and the 31st is lost for good. The test covers only a single call that spans both months. Fix: store the day on the row (like `recurring_debt_payments.due_day`, migration 0194) and pass it in.

3. **D25 markSubscriptionPaid category moves charges out of the Subscriptions budget block.** `src/lib/store/useFinanceStore.ts:1097` now uses `sub.expenseCategory || 'Subscription'`. `src/lib/budget/blocks.ts:57` links the subscriptions block only to category `'Subscription'`. `subscriptionDraft.ts:65` defaults `expenseCategory` to `'Enjoyment'`. Result: a manually paid subscription lands in Enjoyment and no longer counts toward the linked Subscriptions line. SMS dispatch (`dispatch.ts:572`) still writes `'Subscription'` and `subscriptionRecurring.ts:51` writes `expenseCategory`, so three paths now disagree. Fix: pick one rule, either keep `'Subscription'` or link the block by `linkedSubscriptionId`.

4. **I3 pending-job loss on auth and quota errors.** `src/components/features/pending/PendingCapturesChip.tsx:98-104`. `retryable = status === 0 || 429 || >=500`. A 401/403 (session expired while the job sat queued) is non-retryable, so the job is dropped and `deletePendingMedia` destroys the only copy of the recording. A 429 quota denial (stage 'quota', a plan limit) burns an attempt per tap and deletes the media at attempt 3. Fix: keep the job and do not count 401/403 and quota 429; count only 5xx and network failures; delete media only on true 4xx (400/413/422).

## MED

5. **W27 settleBalance precision and negative zero.** `src/lib/savings/balanceMath.ts`. 6 dp rounding truncates BTC (8 dp) and ETH balances; `pocketBalanceInBase` shows BTC/ETH pockets exist, so 0.12345678 BTC is stored as 0.123457 on each deposit or withdrawal. `BALANCE_EPSILON` rose from 1e-4 to 1e-3, so a BTC pocket can overdraw by up to 0.001 BTC (the check passes, `Math.max(0, ...)` clamps). `Math.round(-1e-9 * 1e6) / 1e6` returns `-0` (reversal at `useFinanceStore.ts` ~450), and `Intl` renders "-0". Fix: decimals per currency (8 crypto, 4 XAU) and normalise `-0` to `0`.

6. **W29 default gold price 0, unguarded consumers.** Guarded: `computeDebtPaymentRecord` (rejects `!(price>0)`), net worth, zakat, wealth (use `goldOk`). Unguarded: `useDebtTabData.ts:167,412` (paid-off and totals for gold debts show 0), `useAddDebtSheet.ts:700-721` and `useRecurringDebtPaymentSheet.ts:180` (preview "≈ 0.00g of 24K gold"). The gold recurring-debt auto-post (`recurringDebtDueHandlers.ts:84`) gets `ok:false` and does not post. No division by zero (`moneyToGoldGrams` returns 0). Persisted users keep their price (`goldPriceAvailable` defaults true on rehydrate, `useFinanceStore.ts:2182`), so fresh and reset installs are affected. Fix: gate those previews and totals on `goldPriceAvailable` and show "price unavailable".

7. **Pull pruning on needs_full can drop unpushed rows.** `delta.ts` `applyListWith`: `!live.has(id) && updatedAt <= staleBefore` is dropped, and there is no unsynced flag. A row whose push never succeeded and whose `updatedAt` predates the old cursor is deleted without a push. The window is narrow, but cursors advance on a pull even when the push failed. The comparison is a string compare of `...Z` against Postgres `...+00:00` and uses client clocks, so rows near the boundary can misorder. Budget plans and activations are not pruned, so plans deleted more than 90 days ago can be resurrected. Fix: exempt rows queued for push, compare with `Date.parse`, handle plans.

8. **Enter-to-submit on the expense description.** `src/components/features/expenses/ExpenseSheetForm.tsx:259-262`. With `enterKeyHint="done"`, tapping "Done" to dismiss the keyboard saves the expense with partial or default fields. Some Android IMEs (Gboard Arabic) send Enter with `isComposing` false and keyCode 229, so a composition Enter can save. Fix: advance focus to the next field and keep the Save button as the only commit, or at least reject keyCode 229.

9. **I5 redact key list is too broad.** `src/lib/privacy/redact.ts:1`. It hides any non-object value under `paid`, `limit`, `left`, `each`, `target`, `saved`, `value`, `outstanding`. A boolean `paid` (bill or subscription status), `left` meaning days, or a generic `value` would read "[hidden by the user]", so Buddgy cannot answer "did I pay Netflix". Fix: redact numbers only and use a per-tool key allowlist.

10. **C10 pushMask fails open and masks only the body.** `src/lib/server/sendNativePush.ts`. If the `user_settings` read errors, `prefs` is null and the full text is sent. `title` and `data` are not masked (check callers that put an amount in either). Two extra service reads per push. Fix: fail closed to the generic text on error and mask title and data.

11. **I4 hop derivation is not a hardening.** `src/lib/server/ai/buddgy/validate.ts:89`. A client can append a fabricated tool message to get `chat_hop` billing, as `hop:true` allowed before. Legit multi-hop still works and the client's `hop` field is ignored. Fix: require the previous message to be a `model` message with function-call parts matching the tool result names.

12. **O13 aiRuntimeConfig swallows DB errors.** `src/lib/server/aiRuntimeConfig.ts`. The `platform_settings` read ignores `error`, so a transient failure is treated as "no row" and the env defaults are cached for 30s (an admin-disabled throttle flips back on). Other instances stay stale up to 30s after a save. All callers are awaited (`api/ai/route.ts:44`, `admin/platform/route.ts` x4) and the write path is behind `guardAdmin` with `platform.manage`. Fix: on `error` use `cache?.value ?? defaults` and do not cache. Confirm a `platform_settings` row and RLS for key `ai_throttle` exist.

## LOW

13. **L19 flow ordering.** `flowOrder.ts`: `Date.parse(occurredAt)` can be NaN for a malformed value, so the comparator returns NaN and ordering is inconsistent. Guard with `Number.isNaN` and fall back to noon. Rows without `occurredAt` sort at noon and ties stay stable.

14. **D23 match strictness.** If every method has `closedAt`, the match now returns `''` (it was `methods[0]`), and the fallback ignores `isDefault`. Substring matches under 3 chars are gone, so such hints fall to `open[0]`. Check callers handle `''`.

15. **I9 whisperEcho.** A transcript under 3 normalised characters (a bare "50" or "٥") becomes empty, and a legit "thank you" is dropped. The echo check needs a contiguous 8+ char substring of the prompt, so false positives are unlikely. Dropping `language` leaves Whisper auto-detect, which can misdetect short Egyptian Arabic clips. The pending queue still posts `language`, which is ignored. Duplicate JSDoc above `MAX_AUDIO_BYTES` in `api/voice/transcribe/route.ts`.

16. **I11 and I14 (OK).** Budget AI and receipt deadlines of 52s sit under `maxDuration` 60 (8s left for settle), `/api/ai` 25s of 30s, transcribe 12s of 30s. Receipt 4.0 MB and audio 3.3 MB caps match the 4.5 MB platform body limit. Multi-photo receipts over 4 MB now get a `tooLarge` message instead of a 413 from the platform.

17. **O15/O16 webhooks (OK with notes).** `staleReopen` and `freshHook` are correct; a missing Sentry timestamp passes (documented); `eventAt === resolvedAt` counts as stale. Outbox order (ticket link, then `sent`) is right; a crash between the Linear create and the link still duplicates.

18. **U49 enumeration copy.** Unconfirmed vs wrong-password messages still differ (`src/components/auth/authErrors.ts:104,107`), so existence still leaks via `errorUnconfirmed`. `errorNoAccountForEmail` is now unreferenced. `AuthFormErrorAlert.tsx:39` matches on `errorUnconfirmed`, so the resend action still renders.

19. **X11 not-found.** `src/app/(app)/not-found.tsx` renders only for `notFound()` inside the `(app)` group; unmatched URLs use the root file. Under the in-memory view shell it may never show. Verify on device.

20. **No issue found.** `hawl.ts` local-day fix, `amountInRange`, `pocketBalanceInBase` BTC path, `useNetWorthTrend` keyed state, quota-denied 429 no-retry, and `idleMs` stall handling in `turn.ts`.
