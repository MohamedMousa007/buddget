# Round 6 closing: P3 pass (a11y-design, admin-site, native-notify, offline-state, buddgy-ai)

Status per ID. Migrations 0256 (BAI-5) and 0257 (BAI-6) applied live after a BEGIN-less DO-block probe that ended in RAISE (rolled back); probes in `repro/buddgy-ai/bai5_bai6_probes.sql.txt`.

## buddgy-ai
| ID | Status | What / test |
|---|---|---|
| BAI-4 | Fixed | `tools/revise.ts` `reviseProposalArgs` passes `revising: true`; hook uses it. `tools/__tests__/revise.test.ts` |
| BAI-5 | Fixed | migration 0256: hop reservations capped at (turns+1)*3 per chat in `ai_quota_reserve_v2`; probe result above |
| BAI-6 | Fixed | migration 0257: `ai_assistant=false` also disables `proxy`; probe above |
| BAI-7 | Fixed | `runTurn` arg `tainted`; hook `taintedRef` set once any read ran, reset with the chat. `runTurn.test.ts` (fails without the fix) |
| BAI-8 | Fixed (prompt) / Owner decision (global trust) | `sms/merchantCategoryPrompt.ts` carries merchant+SMS as one bounded JSON data string, control chars stripped; test `merchantCategoryPrompt.test.ts`. Requiring N independent users before a shared AI row is trusted needs a corroboration schema: owner decision |
| BAI-9 | Fixed | `buddgy/__tests__/injectionGolden.test.ts`: recorded-response golden set, 5 injections x (read-then-poisoned-write, tainted later turn) + control |
| BAI-10 | Fixed | receipt zod amount/item/charge bounded to LEGACY_MAX_AMOUNT (`receipt/scan/route.test.ts`); nav auto-run skipped when `afterRead` (`runTurn.test.ts`) |

## offline-state
| ID | Status | What / test |
|---|---|---|
| OFS-2 | Fixed | goal draft/checkpoints/debt-goal-dismissed/accountGapSnooze added to `STORAGE_KEYS`; prefix sweep of `buddget_devices_cache`, `bdg-nw:`, `buddget:flushed:` (`storage/removeByPrefix.ts`); `clearBudgetData.test.ts` |
| OFS-4 | Fixed | `failJob(id, retryable, serverFault)`: dropped after 8 server faults (5xx) only; offline/auth/quota never count; chip shows `pendingCaptures.gaveUp` (EN+AR). `usePendingAiJobs.test.ts` |
| OFS-5 | Fixed | net-worth stamps wiped on sign-out and on a server data-reset wipe (`clearNetWorthStamps` in both wipe branches of `SupabaseFinanceSync.ts`); `removeByPrefix.test.ts` |
| OFS-6 | Fixed | tombstone `deleted_at` via `toServerTime(...)`; `staleWrite.test.ts` OFS-6 |
| OFS-9 | Fixed | `store/persistShape.ts` `dropMistypedFields` runs first in the persist `merge` (a null/string where an array/object lives keeps the default); `persistShape.test.ts` + the 5 corrupt-blob and 15 version fixtures from the repro (`persistCorrupt.test.ts`; v1 resets by design and is excluded) |
| OFS-10 | Fixed | created `public/icons/icon.svg` (copy of the brand `apple-touch-icon.svg`) and `public/icons/apple-touch-icon.png` (180px from `icon-192.png`); `lib/pwa/manifestAssets.test.ts` asserts every `/icons/*` referenced by manifest and layout exists |
| OFS-11 | Fixed (decision: remove) | the "Log a Purchase" shortcut (`/?action=addExpense`) had no consumer; removed from `public/manifest.json` (same test) |
| OFS-12 | Fixed | `flushedFingerprint.ts` memoises a row's hash per row object (WeakMap; rows are replaced, not mutated), `persistBaseline` hashes in `requestIdleCallback` (timeout 1.5 s). `flushedFingerprint.test.ts` (unchanged row serialised once). The report's OFS-12 is the fingerprint cost; the two missing icons are OFS-10 above. |

## native-notify
| ID | Status | What / test |
|---|---|---|
| NAT-4 | Fixed | `notifications/pushRoute.ts` maps `notifType` to `/debts`, `/subscriptions`, `/goals`, `/wealth`, `/reports`; `AppShell` `SmsPushActionHandler` routes `kind==='notification'`. `pushRoute.test.ts` |
| NAT-5 | Fixed | `server/pushPayload.ts`: only `registration-token-not-registered` / `invalid-registration-token` delete a token; collapse key capped at 64 bytes (also `/api/push/send` schema max 64); reserved data keys dropped. `pushPayload.test.ts` |
| NAT-6 | Fixed | hard-coded `badge: 1` removed from the iOS payload (no unread count is available to the sender; omit per the report) |
| NAT-7 | Fixed | `/api/notifications` GET counts unread with a head count query (falls back to the page count on error). `route.test.ts` NAT-7 |
| NAT-8 | Fixed (native, not built) | `DocumentScannerPlugin.kt`: page read/decode/rotate/base64 moved to a single-thread executor, failures reject. Process death while the scanner is open still drops the pending call (not fixable without persisting the call; Capacitor re-delivers nothing) |
| NAT-9 | Fixed | `emitNotification` deletes the just-inserted row when the push could not start (token lookup failed / threw) so the next cron run re-creates and re-sends; an unconfigured Firebase keeps the row. `emitNotification.test.ts` |
| NAT-10 | Already fixed | custom scheme removed from manifest and Info.plist; `supplyChain.test.ts` asserts it |
| NAT-11 | Owner decision | default-off push masking is a privacy product choice; no code change |
| NAT-12 | Confirmed idempotent | second run at 06:00 UTC hits the `notifications_user_dedupe_uq` unique index (23505, no push) and the cursor is a single upsert, so a duplicate run is safe. Dropping the `vercel.json` entry is the server agent's (left untouched here) |

## admin-site
| ID | Status | What / test |
|---|---|---|
| ADS-2 | Fixed | `before` added to the audit metadata of `set_entitlement`, `clear_entitlement` (the deleted row), `set_limits`, `suspend`/`restore` (prior `banned_until`) in `admin/users/[id]/route.ts`, and `staff.update`, `staff.suspend/restore`, `staff.role_permissions` in `admin/staff/route.ts`. Test `admin/users/[id]/route.test.ts`. Staff routes covered by read only (no existing harness for that route) |
| ADS-3 | Fixed | `admin/leads`: without `users.pii` the name is an initial and the message a 40-char preview; `offset` paging (`nextOffset`, 200 per page, clamped). `route.test.ts`. The admin view does not yet show a "load more" control (API only) |
| ADS-4 | Already fixed | `REVOKE ALL ON site_leads FROM anon, authenticated` in migration 0250; live `role_table_grants` now lists only postgres and service_role |
| ADS-5 | Fixed | `/api/site/lead`: per-address cap 3/hour and global cap 3000/day through the shared limiter (fail open as before). `route.test.ts`. No captcha added (owner decision if abuse appears) |
| ADS-6 | Fixed | `admin/users` offset floored and clamped to 0..1,000,000 (`route.test.ts` offset=1e999 etc.) |
| ADS-10 | Already fixed | `closing-a11y-legal.md` |
| ADS-11 | Fixed | `/api/feedback` puts the account id, not the email, in the Linear issue; EN + AR privacy lines now say the account ID is included and that a Linear copy survives account deletion. `route.test.ts` |
| ADS-12 | Fixed | non-internal reply on a ticket with no `user_id` returns 409 and saves/audits nothing; internal notes still work. `tickets/[id]/route.test.ts` |
| ADS-13 | Fixed (decision: audit snapshot, not soft delete) | the delete audit row stores number, subject, status, priority, category, created date, had-account flag and message count (no body text, no address). Test as above |
| ADS-14 | Fixed | step-up now also required to turn maintenance ON and to switch the AI throttle OFF (server + `PlatformView` prompts via `useStepUp`); throttle audit stores `before`. `platform/route.test.ts` |

## a11y-design
Tests: `components/ui/a11yP3.test.tsx` (source and renderToStaticMarkup assertions), `components/reports/chartA11y.test.tsx` (xmldom), `app/globalsContrast.test.ts` (extended), `lib/i18n/localeCookie.test.ts`.
| ID | Status | What |
|---|---|---|
| A11-9 | Fixed | `CardActionMenu`: first item focused on open, ArrowUp/Down (wrapping)/Home/End (`nextMenuIndex`), focus returned to the opener on close; `aria-haspopup="menu"` (+ `aria-expanded` where the trigger owns the state) on the 5 button triggers (heroCardShared, PaymentCardCarousel, GoalDetailSheet, AccountDetailSheet, PlanBar). The WealthList row press is a row tap, not a button trigger, left as is |
| A11-10 | Fixed | `useDialogFocus` (focus, Tab trap, inert background, focus return) on NumberPad, UnifiedDatePicker (replaced its focus-only effect), ExpenseFilters `FilterSheet`, SettingsSearch. FilterSheet stays hand-rolled (it deliberately avoids ModalShell drag-to-dismiss because of range sliders) |
| A11-11 | Fixed | `htmlFor`/`id` pairs in ProfilePersonalDetailsSection (6), settings ProfileBody (5), AuthForgotStep, DeleteAccountDialog, IncomeTemplatePicker |
| A11-12 | Fixed (token change) | light `text-muted` #5F6968, `gold` #896617, `red` #BE343A, `green` #0F7635, `amber` #8C5E0A, `status-ok-fg` #0F7634, `status-danger-fg` #BE3239; dark `text-muted` #879592. All >= 4.5:1 on bg/card/elevated/sunken (+ soft tints for muted); `globalsContrast.test.ts` now covers sunken, soft tints and elevated. Shifts are 1-3 steps, same hue. `docs/DESIGN_SYSTEM.md` updated. NOT updated: `.design-sync/compiled.css` and the marketing `site/home.css` (generated / separate palette; the next design-system re-sync must recompile) |
| A11-13 | Fixed | SelectField open border uses `--color-brand-focus`; the 5 red legal links are primary-ink + permanent underline |
| A11-14 | Fixed (partly) | both charts: `role="img"` + EN/AR summary, and a visually hidden data table (`ChartDataTable`, new tiny primitive, no existing one fits) so values and series are available without colour. Not done: bar patterns/labels for the green/teal pair and replacing the legacy `glass-card` class (design decision: owner) |
| A11-15 | Fixed (targeted) | AuthModal, DeleteAccountDialog, SmsTrackingGuide, GoalAchievedScreen, AccountDeletedScreen moved to `--z-dialog` (celebrations no longer above the 200 toast layer; the auth prompt raised from a 110/120 sheet now renders above it); SettingsSearch to `--z-picker` (no tie with confirm dialogs); splash 9999 to `--z-system`. Won't change: `ModalShell` default z-[100] and the other ~60 literals (re-ordering 25 literal-110 sheets needs on-device verification) and the FAB/BottomNav/AIChat 50 ties |
| A11-16 | Fixed | ActionToast provider always mounts one `role="status"` region (cards carry no role; the check glyph is `aria-hidden`); UpdateToast and StatusPill regions exist before the message; PillHint role removed |
| A11-17 | Already fixed | `closing-a11y-legal.md` |
| A11-18 | Fixed (UpdateToast) / Won't fix (rest) | `shadow-blue-500/20` and `ring-blue-500/20` replaced with `--shadow-lg` and a primary-token ring. The always-dark auth screens, brand marks, OAuth logos and the user-colour swatch fallbacks are intentional (contrast verified in the report) |
| A11-19 | Fixed | QuotaWheel catcher is `Scrim tone="none"` (a real button; Escape already via `useDismissable`) |
| A11-20 | Fixed (first paint) / Won't fix (fragment lang) | `bdg-lang` cookie written by `LocaleProvider`, read by the root layout (`lang`, `data-locale`; static Capacitor build keeps `en`, the provider still corrects it after hydration). Per-fragment `lang="ar"` for Arabic user content (a `<Bidi>` helper) not done: needs a script-detection pass over every user-text site |
