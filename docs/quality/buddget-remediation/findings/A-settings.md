# Investigator A: settings, state persistence, profile (BDG-001, BDG-002, BDG-023)

Read-only; origin/main at 3d65b36f. Native store builds (iOS 146, Android vc180, at 75e4ce8c) contain all code cited here. No unmerged branch touches this area (`git branch -r --no-merged origin/main` lists none of the named claude/* branches except ecstatic-shamir; `claude/inspiring-boyd-84cc3b` is already merged or gone). Commit 29b43ff1 is on main.

---

## BDG-001: theme reverts to dark

| Field | Content |
|---|---|
| Issue ID | BDG-001 |
| Summary | The theme has a lossy server round trip: `system` is stored on the server as `dark`, and the server row is pulled back over the local value, so a choice that looks light reverts to dark on the first pull after the push. |
| Severity | P1 |
| Reproducibility | Mechanism confirmed in code; exact user path unconfirmed. Steps: Settings > Preferences tile "Appearance" cycles light > dark > system > light (`PreferencesCard.tsx:23`). Leave it on System with an OS in light mode (looks light), wait for the next pull (resume, pull-to-refresh, SMS broadcast, reconnect, warm reconcile after a refresh). Local value becomes `dark`. |
| Platform | all (web, iOS, Android); same sync code |
| Affected components | see Evidence |
| Backend dependencies | table `user_settings` (column `theme`, whole-row upsert, no per-field or per-row edit stamp), RPC `sync_pull_v2` (returns the settings row when `updated_at > since - 2 min`), `sync_changed_since` (0301 probe) |
| Root cause | Confirmed (R1) plus ranked hypotheses (R2, R3). Details below. |
| Shared causes | Every `user_settings` column (language, notification toggles, privacy, week start) is pushed as one whole row and replaced wholesale on pull; same exposure. BDG-023/others unaffected. |
| Confidence | R1 high (mechanism); that R1 is what the owner saw: medium. |

### Theme lifecycle (confirmed)
- Default local: `DEFAULT_SETTINGS.theme = 'light'` (`src/lib/store/defaultFinanceData.ts:48`). Pre-hydration script defaults to light (`src/lib/theme/applyTheme.ts` THEME_INIT_SCRIPT, reads `localStorage['buddget-storage'].state.settings.theme`; injected in `src/app/(app)/layout.tsx:136`).
- Store: Zustand persist key `buddget-storage` (`useFinanceStore.ts:2200`), settings merged via `{...current.settings, ...p.settings}` (`:2441`). No migration touches theme (grep of the 17+ migrate branches: only `showAllCurrenciesInForms`, etc.). So (d) persist rehydrate / version migration resetting the field: ruled out.
- Applied at runtime by `useThemeSync` (`src/hooks/useThemeSync.ts`, mounted in `AppShell.tsx:304`) on every change of `settings.theme`, and directly by `applyMerged` (`SupabaseFinanceSync.ts:750`), `PreferencesCard.tsx:97`, Buddgy tool (`lib/buddgy/tools/exec/settings.ts:308`).
- Writers of `settings.theme`: `PreferencesCard.changeTheme` (`:94-98`), `SettingsSearch.ThemeTrail` (`:69`, light/dark only), Buddgy `settings` tool (`exec/settings.ts:96-98`, accepts light/dark/system), QA hook `DevAuthBypassSeed.tsx:56`, JSON import (`financeImportSchema.ts:101`), and the sync pull (`applyMerged`). `reset()` sets `DEFAULT_SETTINGS` (light) (`useFinanceStore.ts:2163, 2397`).
- No other local store (cookie, native prefs) holds the app theme. The marketing site has a separate key `buddget-site-theme` (`lib/site/theme.ts`); not related.

### Server side
- Push: `settingsToRow` maps `theme: s.theme === 'system' ? 'dark' : s.theme` (`src/lib/supabase/remote/mappers/settingsMapper.ts:8`). Test at `__tests__/mappers.test.ts:136` asserts this as intended.
- Row is a whole-row upsert (`remote/sync.ts:328-330`), flushed instantly for the `settings` slice (`SupabaseFinanceSync.ts:309-314, 490-496`). No `edited_at`, no timestamp comparison for settings anywhere.
- Pull: `settingsFromRow` copies `row.theme` verbatim (`settingsMapper.ts:46`). Delta apply (`remote/delta.ts:178-205`): local settings win only when `settingsPending = !deepEqual(local.settings, delivered.settings)` (an unsent edit). Otherwise `d.settings` (the server row) replaces the local settings wholesale. Full-pull fallback `mergeSnapshots` takes `server.settings` unconditionally (`merge.ts:56`).
- Defaults on the server side are DARK: `defaultServerSettings` (`remote/sync.ts:69`), `emptySnapshot` (`snapshot.ts:80`). The DB column default was not found in the migrations folder (only `0125/0131` read the column); needs a query (below).
- `sync_pull_v2` re-returns the settings row for 2 minutes of window before the cursor (`0301_db_load_phase_b.sql:30`, same rule in 0233), and the 0301 probe `sync_changed_since` answers true while `user_settings.updated_at > since - 2 min`. So after any settings push, the next pulls within that window deliver the row.

### Root cause ranking
**R1 (confirmed mechanism): lossy `system` mapping plus server-wins pull.**
1. User taps Appearance until it reads System (light OS: screen looks light; the Monitor icon is the only cue).
2. Store `theme='system'`; instant flush upserts `theme='dark'` (`settingsMapper.ts:8`). Baseline `prevSnap` becomes the snapshot with `system`.
3. Next reconcile (any pull trigger): `delivered.settings.theme='system'` equals local, so `settingsPending=false`; delta carries the row (updated within the window) with `theme='dark'`; `applyDelta` replaces settings; `applyMerged` calls `applyTheme('dark')` and `useThemeSync` re-applies. Theme is dark and now persisted locally as dark.
4. "Holds on first refresh": the refresh boots from localStorage (`system` resolves to light); the warm reconcile only changes it once a pull returns the settings row. The probe skips the pull when the cursor is newer than the row by more than the window; timing makes it look delayed. "While moving between Settings pages": no navigation-triggered pull was found in code (`syncFinanceNow` callers: SMS broadcast `AppShell.tsx:206`, pull-to-refresh, SMS flag prompts, notification deep link, resume `onShow`, reconnect); so this is timing coincidence unless the resume/visibility pull fires on the sheet/page transitions. Not proven.
5. This also explains why it is not a failed-request problem: a failed flush keeps the baseline, `settingsPending` is true, local wins (`baselineAfterFlush`, `delta.ts:185-190`).

**R2 (hypothesis, high plausibility): another writer re-pushing the whole row.** Any second device, older build, or stale cache that changes any setting upserts the entire `user_settings` row including `theme`. No timestamp means last arrival wins, then every other device converges to it on its next pull. A tester with two devices (iOS 146 and Android) or a web tab fits "later, unprompted". Evidence needed: `user_settings.updated_at` vs the moment of revert.

**R3 (hypothesis): new account / cold pull.** A new user's server row defaults to `dark` (default `defaultServerSettings`, likely the column default too). A cold pull (`runFullSync(..., delivered=null)` at `SupabaseFinanceSync.ts:251`, also taken when `profile.id !== userId`) applies the server theme over the local light default. Explains a fresh install starting dark; does not explain a revert after an explicit light, unless the light push was lost (e.g. a quota/second-factor block, `isSecondFactorBlocked` returns false without advancing baseline, but local keeps winning).

Ruled out with evidence: (a) debounce/lost timestamp: settings flush has no debounce (`INSTANT_SLICE_KEYS`), no timestamp exists, in-flight pulls keep local because `delivered` is captured before the tap (`delta.ts:185`); a boot with an unsent edit is protected by `baselineFromFingerprint` replacing the singleton baseline with `emptySnapshot()` (theme dark) so `settingsPending` is true (`flushedFingerprint.ts:79-80`). (b) 29b43ff1: the 3-state cycle existed in `b69d8b3a` (`NEXT_THEME` was already there); 29b43ff1 only moved the control into a tile. The `system` mapping is older (`eafede87`). It did not introduce a second writer. (c) sub-pages writing stale state: all other `updateSettings` calls spread only changed keys (`useFinanceStore.ts:2021-2024` merges `{...state.settings, ...updates}`); the whole-object writers (`noIncomeDeclared`) read the current state. No sub-page mounts and writes theme. (d) persist/migration: no.

### Exposure of other settings
Same path: `language`, `showCents`, notification toggles (`sub_due_reminders`, `goal_alerts`, ...), `privacy`, `month_start_day`, `week_start_day`. They round-trip faithfully (no lossy mapping), so the only exposure is R2 (whole-row last-write-wins across devices). `baseCurrency`/`secondaryCurrency` live on `profiles` and use the `profilePending` rule. `twoFactorEmailEnabled`, `smsTrackingEnabled` are also in the row.

### Proposed solution
Simplest safe fix (suggestion, owner proposals not given):
1. Do not store `system` as `dark`. Options, cheapest first: (i) migration widening the `user_settings.theme` check to allow `system` (if there is a CHECK; query below) and send `system` verbatim in `settingsMapper.ts:8` (one line + `database.types.ts` regen + mapper test update at `mappers.test.ts:136`); old builds that read `system` must tolerate it (they only apply it via `resolveEffective`, which handles `system`; the `financeImportSchema` already allows it). (ii) if no DB change is wanted: make the pull keep a local `system` when the server value is `dark` and the local value is `system` (a guard in `applyDelta`/`mergeSnapshots`); worse, leaves other devices on dark.
2. Make the default light on the server side: `defaultServerSettings`, `emptySnapshot` -> `'light'`, and the column default in a migration (touches new accounts only; existing rows unchanged).
3. For R2: do not rewrite the whole row for unrelated changes. Either send only changed columns (diff `prev.settings` vs `next.settings` in `remote/sync.ts:328`) or stamp the row with a client `edited_at` and compare in a trigger like the other tables. Larger change; Council decision.
4. Hide-the-symptom is not proposed (the brief forbids a workaround that only hides dark mode).
Reuse: `settingsMapper.ts`, `applyDelta` pending logic, existing `edited_at` stale-write trigger pattern.

| Regression risk | Old builds (iOS 146, Android vc180) reading a `system` row; the admin analytics functions that read `theme` (`0125`, `0131`) only select it. Column-level diff changes upsert semantics for the settings row (new row insert must still send all NOT NULL columns). |
| Test that proves it | Unit: `settingsToRow({theme:'system'})` returns `system` and `settingsFromRow` round-trips it; `applyDelta` with local `system`, delivered `system`, server row `system` keeps `system`. Existing neighbours: `delta.test.ts:202` (pending theme), `__tests__/mappers.test.ts:136` (to be inverted), `financeSync.test.ts`. No `e2e/` journey covers theme persistence (grep: only UI sweeps in `e2e/ui/*.mjs` touch the word). Add a journey: set Appearance to System, trigger `syncFinanceNow`, assert `html[data-theme]` unchanged. |
| Missing evidence | The real device history: what the owner tapped, OS appearance, number of devices, row `updated_at`. DB column default and any CHECK on `theme`. |

---

## BDG-002: profile completion bar

| Field | Content |
|---|---|
| Issue ID | BDG-002 |
| Summary | The bar on the Settings profile row is not profile completion; it is the five-step "Finish setup" checklist percentage, drawn with no label. |
| Severity | P3 |
| Reproducibility | consistent: Settings top row shows a 3px progress line under the profile row whenever `pct < 100` |
| Platform | all (the SMS step differs by platform) |
| Affected components | `src/components/features/settings/hub/ProfileBanner.tsx:20-37` (bar, `aria-label=t.setup.chipAria(pct)` = "Finish setup, N% complete", `en.ts:3453`); calculation `src/hooks/useSetupProgress.ts:34-59`; same value also in `layout/ProfileDropdown.tsx:53`, `layout/AuthNavButtons.tsx:34` (header chip), `features/setup/SetupChecklist.tsx`, `onboarding/FlowSetupState.tsx` |
| Backend dependencies | none direct; inputs come from synced store lists |
| Shared causes | none |
| Confidence | high |

### What counts (5 steps, 20% each; `useSetupProgress.ts:36-45, 53-59`)
| Step | Rule | User-actionable | Can change without user action |
|---|---|---|---|
| accounts | any `paymentMethods.some(isSetUpAccount)` (`accounts/kinds.ts:42`: open account, Cash only when its balance is tracked) | yes | Cash is seeded untracked for everyone, so it does not count; server pull can add accounts |
| sms | `useSmsArmed()` (`hooks/useSmsTracking.ts:31-55`): native = bridge status `enabled`, until it answers falls back to synced `smsTrackingEnabled`; web = `smsTrackingEnabled` only | partly: only where SMS exists (Android; iOS has the Shortcuts path; web cannot arm) | YES: it flips between the cached intent and the native status after mount, and on every `visibilitychange` / queue event; on web and iOS it may be unreachable, so the bar cannot reach 100% there |
| payday | `incomeSources.some(isRecurring)` | yes | pull adds sources |
| budget | any live plan with a category amount > 0 | yes | pull adds plans |
| expense | `expenses.length + incomeEvents.length > 0` | yes | SMS-captured rows, pulls |

Stability: the value is derived from the cache-first store, so it can change between a refresh and the first pull completing (lists fill in) and when the native SMS status resolves. It is deterministic once synced.

### Proposed solution
- Label and explain: add a text line "Setup" with `{done} of 5` (reuse `t.setup.progress` and `Progress`/`SetupChecklist`; copy exists: `t.setup.title`, `t.setup.chipLabel`), and make the row open the checklist sheet that `AuthNavButtons` already uses. Reuse, no new component.
- "Profile completion from meaningful fields": the calculation does not use profile fields (name, avatar, email) at all. Owner should decide whether this bar means onboarding setup (current, rename it) or true profile fields (new calculation). Renaming is the simplest.
- Fix instability: hide the sms step when SMS capture is not available on the platform (check what `SmsCard.tsx` does), and count `pct` over the visible steps; keep the sms fallback to the synced intent.
| Regression risk | Header chip and Flow setup card share the hook; changing step list changes their count (`useSetupProgress.test.ts` exists, `ProfileDropdown.test.tsx`). |
| Test that proves it | Existing `src/hooks/useSetupProgress.test.ts` for any calculation change; label/copy change is owner review. |
| Missing evidence | Whether iOS arms SMS through the same bridge status. |

---

## BDG-023: move biometrics to Privacy & Data

| Field | Content |
|---|---|
| Issue ID | BDG-023 |
| Summary | Biometrics is a render-only move, but "Privacy & Data" is only a Settings hub section heading, not a screen, and the control has a dependent sibling (App lock). |
| Severity | P3 |
| Reproducibility | consistent |
| Platform | iOS / Android (control hidden when biometry is unavailable) |
| Affected components | see below |
| Backend dependencies | none for display; `/api/biometric/register` and `/signin` are called by `registerBiometric` and stay unchanged |
| Confidence | high |

### Where things are (confirmed)
- "Sign-in & security" = screen `/settings/security` (`src/app/(app)/settings/security/page.tsx`, title `copy.security.title`, `settingsHubCopy.ts:198`). Body is `SecurityBody` in `components/features/settings/hub/SecurityCard.tsx:21-90`: email, change password, 2FA switch, `<div data-setting-id="biometric"><BiometricLoginToggle .../></div>` (`:73`), `<div data-setting-id="appLock"><AppLockToggle/></div>` (`:74`), Devices row; then `BalancePrivacyCard` (hidden-balance masking, section titled `accountsPage.privacyTitle`) and `DeleteAccountCta` (`security/page.tsx:25-27`).
- "Privacy & data" = hub heading `copy.page.privacy` (`settings/page.tsx:60-64`) with two rows: Sign-in & security (`/settings/security`) and Data & backup (`/settings/data`). `/settings/data` renders `DataCard` (not-counted, CSV export, restore). So there is no Privacy & Data screen; the biometric toggle already sits under that hub section, one tap deeper.
- One preference, device-local: `BiometricLoginToggle` reads `isAvailable()/isEnabled()/getLinkedAccount()` from `lib/native/biometricAuth` (native secure storage, not the Zustand store or `user_settings`). It returns null when biometry is unavailable (`:51`, `if (!available) return null`) so the same capability checks move with the component. `AppLockToggle` appears only when biometric is on (`AppLockToggle.tsx:37-48`), so the two must move together.

### What a move touches
- Render: `SecurityCard.tsx:73-74` (remove) and the target page/card (add). Props needed: `userEmail`, `hasPassword` (derived from `user.app_metadata.providers` at `SecurityCard.tsx:31`); the target must compute `hasPassword` too or receive it.
- Search registry `src/lib/settings/registry.ts:56-57`: `biometric` and `appLock` use group `security` and route `/settings/security`; update both to the target group/route. Group name shown in search results comes from `copy.groupName[entry.group]`; row tone from `GROUP_TONE[group]` (`groupMeta.ts`). Hub focus uses `data-setting-id` (`settings/page.tsx:34-46`), so keep those wrappers.
- Copy: `settingsHubCopy.ts:198` subtitle "Password, two-step, biometrics, app lock" mentions both; and Arabic `:419`; `items.biometric/appLock` entries.
- Tests/refs: `src/lib/settings/registry.test.ts` (routes must be shell paths, copy per id), `e2e/journeys/specs/round2/r1-core.spec.ts:180` (only visits `/settings/security`, expects text "Sign-in & security"), `lib/buddgy/tools/__tests__/settings.test.ts:174` (biometric is blocked for Buddgy; unaffected), admin `lib/admin/search/index.ts:47` (admin portal, unrelated). No component test for the toggles; `biometricRegister.test.ts` covers the lib only. No deep link strings other than the registry and `reset-password/confirm/page.tsx:142` (goes to `/settings/security`, no anchor).
- Owner decision needed: target. Options: (A) add to `/settings/data` (rename it Privacy & data), (B) next to `BalancePrivacyCard` on the existing security screen (still a screen titled Sign-in & security), (C) make a new Privacy screen. A is simplest but renames a route's meaning; a gating point: `data/page.tsx` has no user/auth props, and `DataCard` is shown for signed-out users too (biometric needs `user`).
| Regression risk | Signed-out users on `/settings/data` (no `user`); losing `hasPassword` (breaks re-auth prompt for Google/Apple accounts); orphan App lock if split. |
| Test that proves it | Owner review (visual) plus a registry test asserting `biometric.route === appLock.route` and that both routes render the toggle containers. |
| Missing evidence | Owner's intended target page. |

---

## Queries for the lead
```sql
-- column default and any check on theme
select column_default from information_schema.columns where table_name='user_settings' and column_name='theme';
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.user_settings'::regclass and contype='c';
-- distribution (counts only)
select theme, count(*) from public.user_settings group by theme;
-- tester row timing (ids only; replace with the owner's user id)
select user_id, theme, updated_at from public.user_settings where user_id = '<owner uuid>';
-- is there a trigger on user_settings
select tgname from pg_trigger where tgrelid='public.user_settings'::regclass and not tgisinternal;
```

## Decisions that need the owner
- BDG-001: accept `system` as a real stored value (needs migration), or drop the System state from the tile (two-state light/dark), which removes R1 with no DB change. Second option is simplest.
- BDG-002: does the bar mean "setup" (rename it) or true "profile completion" (new field list)?
- BDG-023: target screen for biometrics and App lock (A/B/C above).

## Decisions that need Council
- BDG-001 R2: field-level or `edited_at`-stamped settings sync versus whole-row last-write-wins across devices (touches the sync contract for every setting).
