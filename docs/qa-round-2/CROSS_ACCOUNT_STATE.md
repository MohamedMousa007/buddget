# Cross-account local state (income_event.template_id -> other user's source)

Root cause: `buddget-storage` (zustand persist, localStorage) hydrates before auth resolves (cache-first boot).
Nothing compared its owner (`profile.id`, `settings.serverSyncedFor`) with the session user. Wipes ran only on
SIGNED_OUT / explicit signOut (AuthProvider.tsx) so a sign-out killed mid-teardown, a SIGNED_IN as another user
over a live session, or a cross-tab expiry left user B's rows in the store. On A's sign-in the cold path
(SupabaseFinanceSync pull) took `applyDelta/mergeSnapshots(local, server)` = union by id, so B's income source showed
in A's UI; A confirmed a payday against it and `flushDiff` pushed the event with B's source id. If the pull failed,
baseline was empty and the first flush would have pushed ALL of B's rows under A.

Repro: sign in as B, populate; kill the app between `auth.signOut` and `clearBudgetData` (or sign in as A via OTP/OAuth
without SIGNED_OUT); sign in as A; B's sources appear; confirm payday against one.

Fix: `src/lib/auth/cacheOwner.ts` (+ `cacheOwnerCheck.ts`): `reconcileCacheOwner(userId)` called in AuthProvider before
every `setUser` (listener, getSession, biometric unlock) wipes via `clearBudgetData` on owner mismatch;
SupabaseFinanceSync re-checks at mount and refuses to flush when the cache owner differs. Other stores
(settings, pending AI jobs, cursors, reset-seen) are cleared by `clearBudgetData`; the other localStorage keys are
already userId-scoped. SW caches only static assets / next-data (no user finance API). Not covered: B's unflushed edits
on a direct B->A switch are discarded (by design).
