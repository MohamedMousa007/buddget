# Round 6 closing: sync stale-write redesign (REG-1, REG-4, OFS-1, SLG-2, OFS-3, OFS-7, OFS-8)

Status: COMPLETE. Owner authorised live DB changes (project ydihurtbcnoflhormgzi).

## Design (one coherent redesign)
- `updated_at` = server write time only (pull cursor), always `now()` on INSERT and UPDATE. Never sent by the client.
- New `edited_at` (NOT NULL default now()) on all 21 guarded tables = user edit time on the server clock, clamped to <= now(); moved only by user pushes. Server-side writers (SMS pairing, price cron, month-carry, adoption, tombstones) do not set it: they always pass and never make a later user edit stale.
- Guard compares `edited_at` to stored `edited_at` (3 s tolerance for clock-offset jitter). Stale undo-of-delete only un-deletes (keeps newer content).
- Client: store `updatedAt` now maps to `edited_at`; `withEditTime` sends `edited_at`; pull merge takes a `delivered` baseline so a local row beats the server copy only when it holds an undelivered edit (no offset-jitter ties).

## Migrations (applied live, probes rolled back)
- 0240_edited_at_column.sql: APPLIED LIVE. Column added + backfilled (= updated_at) on 21 tables, triggers disabled during the backfill (no updated_at bump). Verified: 21 cols not null default now(), 0 mismatches, 0 disabled triggers.
- 0241_newest_edit_wins_triggers.sql: APPLIED LIVE. `private.stamp_insert` (a0_stamp_insert, BEFORE INSERT) and `private.reject_stale_write` rewritten (a0_reject_stale_write).
- 0242: not used.
- Probes (BEGIN-less DO block ending in RAISE = rolled back, scratch auth user + buddgy_memories on the LIVE triggers, then a temp-table copy before applying): insert with 3 h old updated_at -> updated_at now, edit time kept (REG-1); future insert clamped (OFS-1); edits A(+10m) then B(+20m) -> B wins, B then A -> A skipped rowcount 0 (SLG-2); server writer update keeps edited_at, later user edit rowcount 1 (REG-4); stale revive keeps content and un-deletes (REG-6); within 3 s accepted, 1 min older rejected.

## Done in code so far
database.types.ts (edited_at x21), mappers (edited_at both ways), sync.ts (withEditTime, bisecting upsert + parked rows for any 22xxx/23xxx/42501, FlushResult.parked), parkedRows.ts, useSyncFailures.setAside + SyncFailureBanner + EN/AR `syncFailures.setAside`, serverClock (hysteresis, future clamp), merge.ts/delta.ts (pending-aware merge, `delivered` baseline), SupabaseFinanceSync (parked baseline, delivered baseline, cursor never ahead of an unpersisted store, flush on quota), safeLocalStorage.hasUnpersistedWrites.

## Per ID
- REG-1 Fixed: `a0_stamp_insert` sets updated_at = now() on every INSERT (21 tables, live); client no longer sends updated_at. Tests: staleWrite.test.ts (offline insert visible to another device's delta), live rolled-back probe A.
- OFS-1 Fixed: edited_at clamped to <= now() on INSERT and UPDATE in the DB; client also holds a device stamp at the server's now (serverClock). Tests: staleWrite (future insert), serverClock.test.ts, probe B/B2.
- SLG-2 Fixed: guard compares edit time to stored `edited_at`. Tests: convergence.test.ts (300 seeds x 60 steps, 3 devices, real flushDiff/applyDelta: all converge AND newest edit wins on every seed; verified it fails against the old updated_at guard), staleWrite AB/BA order, probe C.
- REG-4 Fixed: server writers never move edited_at and always pass; a later user edit lands. Tests: staleWrite REG-4, convergence (server writer steps), probe D. REG-6 (stale revive overwrote newer content) fixed as part of it (probe E).
- OFS-3 Fixed: bisecting upsert; any 22xxx/23xxx/42501 row error parks only that row (`FlushResult.parked`), baseline advances for the rest (`holdParkedBack`), visible via SyncFailureBanner (EN+AR `syncFailures.setAside`), re-offered each flush. Test: poisonRow.test.ts (6 codes, <40 requests for 200 rows). Updated payday/link-tier/savings tests.
- OFS-7 Fixed: `storage` event -> `persist.rehydrate()` (crossTabSync.ts, hooked at the end of useFinanceStore.ts). Test: crossTabSync.test.ts (two store instances over one shared storage). Limit: the finance store only (settings store untouched); a write queued in the last 150 ms in the receiving tab is dropped in favour of the foreign copy.
- OFS-8 Fixed (graceful path, no engine change): no cheap shrink exists (rows are the data; fingerprint needs a per-row hash). Instead a refused save now (a) flushes unsent edits to the server at once, (b) never writes a sync cursor ahead of the stored copy (and clears it), so a restart does a full pull instead of silently missing rows, (c) keeps the existing in-memory copy and one-time toast. Tests: safeLocalStorage.test.ts (`hasUnpersistedWrites`). Real fix for 15k+ row users remains moving rows off localStorage (explicitly out of scope).
- Side effect: REG-7 partly mitigated (offset hysteresis + future clamp). REG-5 not addressed.

## Known limits
- App builds already in the field still send `updated_at`; the DB ignores it (always now()) and their pushes carry no edited_at, so they pass unguarded and do not advance edited_at (pre-0232 behaviour) until updated.
- Tombstones still bypass the edit-time check by design (delete wins); OFS-6 untouched.
- Edits < 3 s apart from different devices: last pusher wins.

## Verification
vitest src/lib/supabase, src/components/sync, src/lib/store: 49 files / 290 tests pass in Africa/Cairo and America/New_York. eslint on touched files: 0 errors. tsc: only pre-existing errors in ModalShell.exit.test.ts and hooks/__tests__/liteReact.ts (other agents' files). Live: 21 tables with edited_at NOT NULL default now(), 0 mismatches vs updated_at after backfill, 21 insert + 21 update triggers, 0 leftover probe users.
Files: supabase/migrations/0240, 0241; database.types.ts; remote/{sync,delta,merge,serverClock,parkedRows}.ts, mappers/*; components/sync/SupabaseFinanceSync.ts; lib/store/{crossTabSync,useSyncFailures,safeLocalStorage,useFinanceStore}.ts; SyncFailureBanner.tsx; i18n en/ar/types; docs/OFFLINE_GUIDE.md; tests under remote/__tests__ (fakeEditTimeServer, staleWrite, convergence, poisonRow), serverClock.test, merge.test, crossTabSync.test, safeLocalStorage.test.
