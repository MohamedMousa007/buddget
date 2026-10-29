# Final adversarial review (uncommitted diff)

tsc clean, eslint 0 errors. CSP string byte-identical (csp.ts is a pure move; middleware import ok).

## Blockers
None found.

## High / Medium
1. MEDIUM, src/components/features/auth-modal/AuthFormErrorAlert.tsx:39 + src/components/auth/authErrors.ts:103.
   The "Send new code" link is now keyed on errorBadPassword, so it shows for EVERY wrong password (before: only unconfirmed).
   resendCode (useAuthModal.ts:551) only sends signInWithOtp and starts a cooldown; it does not move to the OTP step, so the user gets an email
   but no code field on the password step. For a non-existent email, signInWithOtp(shouldCreateUser:false) errors and is mapped via
   mapAuthError(...,'resend'); check that mapping does not say "no account" (re-opens the enumeration the test claims to close).
   Fix: have the link call the same path as verify-pending (set emailStep/verifyStep to the OTP step), or drop the link for bad-password.
   Unconfirmed users now lose their specific message (acceptable by design; hint text still covers it).
2. MEDIUM, src/components/auth/SecondFactorGate.tsx:62. verifyOtp on an already-signed-in session emits SIGNED_IN and rotates the session id.
   AuthProvider SIGNED_IN handlers (splash latch, device/check, NativeBootstrap keyed on user id) may re-run. Same user id so it should be benign,
   but device-test once with mode=enforce; production mode is off/report so the gate never opens.
3. LOW, src/lib/auth/secondFactorGate.ts:55. noteSecondFactorResponse awaits res.clone().json() on any 403 from apiFetchAuth.
   A 403 with a never-ending/streamed body would delay the caller. Fix: cap with Promise.race timeout or only inspect when content-type is json.
4. LOW, src/components/sync/SupabaseFinanceSync.ts:278. flush() returns false while blocked; callers treating false as "failed" (pendingSync loop,
   sign-out flush) may skip the pull or show failure. No retry timer is set, resume relies on onSecondFactorResolved. After the 5 min suppress
   window nothing re-flushes until the next mutation. Acceptable, only matters in enforce.
5. LOW, sync.ts:226-238 (W7). Logic is sound: inserts+balance-changed rows share one batch (atomic, a failed batch retries the whole diff because
   prevSnap does not advance), metaOnly rows all have identical keys (so supabase-js defaultToNull does not null the balance), deletes unchanged.
   Residual: a metaOnly row whose server row was hard-deleted would take the INSERT path with current_balance NULL (NOT NULL violation, 23502, not in
   PER_ROW_RETRY_CODES so it surfaces as a banner error each flush). Rare. Fix: add 23502 handling or ignore.

## Verified OK
- Fetch wrapper (client.ts): returns the original Response; body touched only via clone() and only on status 403 (and only /rest/v1 for body).
  No clone on 200/streaming/realtime (websocket not via fetch)/auth refresh. 403s without the header/code are ignored. In off/report mode the
  server never emits the refusal, so it is a no-op apart from one wrapper hop and a header read on 403.
- Gate mount in AuthProvider is inside the signed-in branch and renders null when closed.
- Buddgy hop validation: client history from compressHistory is text-only (no tool messages), runTurn pushes {model parts}+{tool results}
  in the same hop where parts and calls come 1:1 in order from turn.ts, so each tool name is in the preceding model message. Parallel same-name
  calls work (multiset consume), multi-name tool messages work, multi-hop works. Legit 400 risk only if executeCalls emits a result for a call
  absent from parts (not possible) or the model calls an unknown tool (already rejected before this change).
- gemini validateAiRow: equivalent to the old zod schema for null/undefined/coercion cases checked (confidence coerce incl. null->0, "" ->0, NaN reject,
  data default {}, arrays rejected by both). No voice/receipt regression found.
- shortDate/useShortDate/useCategoryLabel: hooks are called at top level of components/hooks (no conditional, no non-component use found);
  English output unchanged (formatLocalized with en locale, default locale arg 'en'); useCallback keeps identity stable per locale; per-call cost
  is one date-fns format, same as before.
