# Shared causes and dependencies

## Shared causes

| # | Shared cause | Issues | One fix, where |
|---|---|---|---|
| S1 | **Settings travel as one whole row with no edit stamp, and one field is stored lossily.** A pull or another device replaces everything. | BDG-001; exposes language, notification toggles and the account SMS preference (`sms_tracking_enabled` is in the same row), so BDG-008 too; made worse on main by R17 (BDG-H2) | The settings mapper and the pull merge (`settingsMapper.ts`, `delta.ts`), after the sync branch is merged, because that branch changes the same files |
| S2 | **One per-chat spend counter is used as a "context" signal, and every call feeds it**, including hops and failures. The 7.6 thousand token tool prefix, mostly uncached, drives both the cost and the early "long chat" note. | BDG-011, 013, and the size of 012's problem | Accounting first (turn id, final outcome decides), then stop using spend to trim history, then shrink or cache the prefix |
| S3 | **The chat is an overlay that stays open while the app navigates underneath.** | BDG-009, 016, 015, and the in-chat "Go Pro" and "See usage" links | One rule in one place: from inside the chat, either open a sheet above it or close the chat before navigating |
| S4 | **Chat panel and orb geometry come from `window.innerHeight` and fixed constants.** | BDG-014, 018 (the keyboard resize saves a wrong orb position) | One geometry helper based on the visual viewport and safe areas; never save while the keyboard is up |
| S5 | **The UI states success from a local claim, before the server confirms.** | BDG-008 ("Automation active" without a test SMS), BDG-019 ("Welcome to Pro" without a verified transaction, "Restored" with nothing restored) | Show "confirmed" only from a server fact: the first SMS from this device; an entitlement row whose source is a store |
| S6 | **Account state and device state are read from the wrong side.** | BDG-008 (pill reads the account), BDG-002 (setup percentage changes by device), BDG-020 (store shown follows the device, not the subscription) | Per-device `last_sms_at` (exists), platform-aware setup steps, `store` on `/me` |
| S7 | **One shared flip component.** | BDG-003 on four cards | `FlipCardRig` |
| S8 | **Seven single-choice pickers.** | BDG-026, 027, 028 | One standard picker for this sheet; wider consolidation is optional |
| S9 | **No purchase has been proven end to end.** Store setup is done for iOS (owner; RevenueCat checked 2026-11-20), yet the database holds no billing event. | BDG-019, 020, 022 cannot be verified end to end | Owner steps: Paid Apps agreement, banking and tax active; In-App Purchase key in RevenueCat; two webhook secrets on Vercel |
| S10 | **Live database is ahead of main**; the sync and S8a branches are unmerged. | BDG-H1, H2; anything here that touches sync files | Merge order: sync, S8a, S-2, then this program |

## Dependency graph

```
Preconditions (not this program's code)
  P-a  sync branch green (job 18), then sync, S8a, S-2 merged ──┐
  P-b  owner store steps (S9) ─────────────┐                    │
  P-c  a reachable cloud QA runner         │                    │
                                           │   │
Track 1  Settings                          │   └─> BDG-001 (mapper + enum migration + merge rule)
                                           │
Track 2  Buddgy money and memory           │
  BDG-011 accounting (migration) ──> BDG-013 context ──> BDG-012 copy
                                └──> BDG-010 label (uses the same final frame)
  BDG-009/016 usage sheet ──(uses the BDG-012 reset formatter)
  BDG-015 action protocol (independent; shares the "close chat before navigating" rule with 009)

Track 3  SMS device state
  migration (first_sms_at) ──> native action order + state derivation ──> Settings card + guide + onboarding ──> X button

Track 4  Billing
  BDG-019 client fixes ──> BDG-020 Manage sheet (+ `store` on /me) ──> BDG-021 polish
  BDG-022 transaction ownership + reconcile job (migration) ── must land before a second store sells
  end-to-end verification of all four ──> needs P-b

Track 5  Cards and invites
  BDG-003 flip rig ──> BDG-004/006 copy and layout ──> BDG-005 share image (if approved)
  BDG-007 streak (independent)

Track 6  Chat geometry and navigation
  geometry helper ──> BDG-014 ──> BDG-018
  BDG-017 back controls + edge swipe (independent)

Track 7  Savings sheet
  picker ruling ──> BDG-026 ──> BDG-027/028

Track 8  Visual only (mockup first)
  BDG-002, 023, 024, 025, 021
```

Tracks 2 to 8 do not share files with each other, with two exceptions: the usage sheet (track 2) and the Manage sheet (track 4) both live under the billing components, and tracks 2 and 6 both touch the chat component. Those pairs must not be built in parallel.

Every app change reaches phones only through a native build, so the tracks end in one build, not one per track.

## Links to the earlier database work
- **Phase B `sync_changed_since`**: not a cause of BDG-001. It only decides whether to pull; the overwrite happens in the merge.
- **AI-credit counters (phase B)**: reverted by migration 0302; charging today sums cost from `ai_usage_events`. Not a cause of BDG-011, but the outage window (8 to 16 November) overlaps the older counters, which is why the owner's lost usage cannot be reconstructed from current rows.
- **Cron consolidation, notifications, caching, retention**: no link found to any of the 28 issues. All 15 pg_cron jobs are active.
