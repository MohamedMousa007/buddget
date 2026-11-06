# Round 6 closing: security (P1 + P2 fixes)

Status as of this write (in progress; final status appended at the bottom when finished).

## Migrations applied LIVE on ydihurtbcnoflhormgzi (all complete, none half-applied)
| File | What | Live probe (rolled back, `repro/closing-security/` + `repro/db-security/xtenant_link_rpc.sql.txt`) |
|---|---|---|
| 0244_cross_tenant_link_guard_dead_rpcs.sql | DBS-1/2, DBI-8: REVOKE EXECUTE on the 6 dead DEFINER RPCs from PUBLIC/anon/authenticated (src has 0 callers); `assert_link_owner` added to subscriptions, recurring_expenses, recurring_debt_payments, recurring_savings_deposits, savings_holdings, receipts; expenses and savings_accounts guards extended | original probe now: insert of foreign link = 23503; both RPCs = 42501 permission denied; B's row untouched |
| 0245_device_session_and_merchant_category_hardening.sql | AUT-8: `user_devices.session_id` + `revoke_auth_session(user, session)` (service_role only); DBS-4: global category needs >=5 distinct accounts older than 7 days with a strict lead, sample_merchant = key, anon/authenticated lose all access to merchant_categories | `dbs4_merchant_categories.sql.txt`: rows 0,0,0,0,1; 5 fresh sybils = 0; anon = permission denied. `aut8_revoke_session.sql.txt`: wrong owner 0, ok 1, other session kept, refresh tokens cascaded, authenticated denied |
| 0246_admin_directory_masked_search_promotion_floor.sql | ADS-1: `admin_user_directory` 7th arg `p_match_email` (default false = masked-only match, wildcards escaped; old 6-arg dropped); SLG-3: promotion eligibility repaired to tier 'template'/status 'active' with floors >=5 users, >=7 days (config raised to 5/7 as well) | `ads1_slg3.sql.txt`: unmasked substring and full address = 0 without PII, masked form = 1, `%`/`_` = 0; 4 users/30d = 0, 5 users/3d = 0, 5 users/8d = 1 even with config lowered to 1/0 |
| 0247_ai_quota_reserve_v2_chat_ok_only.sql | BAI-1: v2 chat per-day clause counts status 'ok' only | `bai1_quota_v2.sql.txt`: 3 failed chats at cap 2 = allowed; after 2 ok = denied chat_messages_day |

database.types.ts updated (user_devices.session_id, admin_user_directory.p_match_email, revoke_auth_session).

## Code done so far
- SST-1/SST-5: `hasRevokedDevice` (registry); setup-token GET/DELETE and push/register refuse header-less requests (403 device_required) when the account has removed a phone; header-less DELETE rotate only deactivates device-less tokens; `smsDeviceGate` refuses header-less JWT calls for such accounts even with SMS_REQUIRE_DEVICE_HEADER unset. Measured: 19 active tokens, 6 device-less; 0 accounts with a removed phone hold a device-less token, so no installed build is locked out. Flag default for all other accounts unchanged (older builds send no header).
- DBS-3/NAT-2 server half: password change retires all the user's ingest tokens before changing the password and mints a fresh one for the calling device; new `POST /api/sms/revoke-token` (this device's tokens, or device-less ones). Hashing the token at rest NOT done: `GET setup-token` must return the stored token to re-arm installed builds and the Settings card, so a one-way hash would break them.
- AUT-8: heartbeat records the JWT `session_id`; removing a phone calls `revoke_auth_session`. Legacy devices (no recorded session until their next heartbeat) cannot have their session ended; the user must change the password. The already-issued access JWT lives until expiry.
- AUT-2: `resolveActiveApiIdentity` used by requireAiUser (ai, buddgy/turn, buddgy/usage), receipt/scan, voice/transcribe, budget/ai.
- ADS-1 route passes `p_match_email: ctx.canSeePii` and audits searches; ADS-7 site_leads deleted by email in `scrubPersonalText` and exported by email; REG-3 `POST /api/sms/dismiss` + `dismissSmsLog` via it (tests added, passing).

## Final status (all requested IDs closed; nothing half-applied)
Post-probe check on live: 0 leftover qa6 users / rows / sessions; authenticated cannot execute the 6 revoked RPCs, `admin_user_directory`, `check_sms_promotion_eligibility`.

| ID | Status | Files / test |
|---|---|---|
| DBS-1 (+DBS-2, DBI-8) | Fixed | migration 0244; probe `repro/db-security/xtenant_link_rpc.sql.txt` re-run: insert of a foreign link raises 23503, RPCs 42501, B's row untouched. Audit of the other DEFINER functions granted to authenticated (deposit/withdraw/correct_savings_v2, analytics_touch, second_factor_status, app_client_gate, db_pre_request, savings_delta_enabled): all filter by `auth.uid()`/user_id; no unfiltered update. Not done (P3, not requested): DBS-5/6/9/10, SST-8 grant tidy-ups |
| DBS-3 + NAT-2 (server) | Fixed (decision: no hash at rest) | password change retires all tokens + mints one for the calling phone (`password/change/route.ts`, tests in `route.test.ts`); `POST /api/sms/revoke-token` + `revokeIngestToken` called on explicit sign-out in `AuthProvider.tsx` (`headerless.test.ts`). Hash at rest rejected: `GET setup-token` must return the stored token to re-arm installed builds and the Settings card; hashing would force a rotate on every call and break them. A parallel session also added the native `clearSmsCredentials` call at sign-out |
| DBS-4 | Fixed | migration 0245, probe `dbs4_merchant_categories.sql.txt` |
| SST-1 / SST-5 | Fixed | `registry.hasRevokedDevice`, `setup-token`, `push/register`, `deviceGate.ts`; tests `headerless.test.ts`, `deviceGate.test.ts`. Data (2026-11-06): 19 active tokens, 6 device-less; 0 accounts with a removed phone hold a device-less token. Migration path: the refusal is on for any account with a removed phone; `SMS_REQUIRE_DEVICE_HEADER` stays opt-in for everyone else because installed older builds send no header (owner can set it to 1 once those builds are gone) |
| AUT-2 | Fixed | `resolveActiveApiIdentity`; ai, buddgy/turn, buddgy/usage, receipt/scan, voice/transcribe, budget/ai; `src/app/api/suspendedAccount.test.ts` |
| AUT-8 | Fixed; legacy devices documented | migration 0245 (`user_devices.session_id`, `revoke_auth_session`), heartbeat records the JWT session, removal deletes it; probe `aut8_revoke_session.sql.txt`; tests in `headerless.test.ts`. Devices without a recorded session (all rows today until their next heartbeat) cannot have their session ended: the user must change the password. The access JWT already issued lives until expiry (JWT lifetime, 1 h default) while SMS/push routes refuse it at once |
| ADS-1 | Fixed | migration 0246; `admin/users/route.ts` (+ audit of searches); `route.test.ts`; probe `ads1_slg3.sql.txt`; `database.pg.test.ts` signature updated |
| ADS-7 | Fixed | `scrubPersonalText` deletes `site_leads` by lower-cased email (self-service + admin + staff self-empty share it); `exportUserData(..., email)` exports them; export route passes the address; tests in `deleteAccount.test.ts`, `userData.test.ts` |
| REG-3 | Fixed | `POST /api/sms/dismiss` (owner in filter, device gate), `dismissSmsLog` uses it; `dismiss/route.test.ts`, `confirmActions.test.ts` |
| SLG-3 | Fixed, safe floors documented | migration 0246: tier 'template'/status 'active'/not merged, floors in the function itself: >= 5 distinct users, >= 7 days (config cannot lower them; config row raised to 5/7), plus the existing match/confidence/failure gates and the app-side replay-regression gate. Probe: 4 users/30 d no, 5 users/3 d no, 5 users/8 d yes even with config set to 1/0 |
| BAI-1 | Fixed | migration 0247; probe `bai1_quota_v2.sql.txt` |
| BAI-2 | Fixed | `buddgy/tools/amountGuard.ts` + wrapper in `define.ts` (one bound = `LEGACY_MAX_AMOUNT`, finite, >= 0, not -0, applied to every `MONEY_PARAMS` number incl. nested `adjust_budget.ops[].amount`); table-driven `__tests__/amountBounds.test.ts` over every write spec x {1e300, Infinity, NaN, negative, -0, over ceiling} and a classification test that fails if a new numeric param is unclassified |
| BAI-3 | Fixed | `redactBalances(value, withFlow)` masks income, spent, budget, cap, net_cash_flow, safe_daily, projected_spend for the Buddgy mask in every read result (`runTurn.ts`); tests in `redact.test.ts` and `runTurn.test.ts` |

AUT-1 / 2FA platform flag: untouched (report mode, owner decision).

Verification run: scoped vitest (tools, privacy, buddgy client, sms, devices, auth/password, server, admin users, suspendedAccount) green; eslint on touched paths 0 errors; `tsc --noEmit` clean for these files (two unrelated errors from other sessions: ModalShell.exit.test.ts, hooks/__tests__/liteReact.ts). Full gate (`npm run verify`) left to the coordinator.
