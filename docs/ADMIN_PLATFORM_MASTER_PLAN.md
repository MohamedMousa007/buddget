# Buddget Admin Platform — Master Plan

Owner-authored, decisions locked to the recommendations in section 11 (approved 2026-10-23). Review findings, corrections and build status: `docs/ADMIN_PLATFORM_REVIEW.md`. Where the review disagrees with this plan, the review wins (notably: do not revoke `anon` on `app_client_gate`).

Evidence tags: **[Code]** read in the repo. **[DB]** measured on the live database. **[Inferred]** conclusion. **[Verify]** external fact to confirm before relying on it.

## 1. What exists today (and what is missing)

| Area | Exists | Missing |
|---|---|---|
| Portal shell | `/admin`, 14 views, in-memory views, nav in `src/lib/admin/nav.ts`, guard in `src/lib/server/admin/guard.ts` | Role-aware home, lazy-loaded views, department grouping |
| Access control | 29 permissions, 8 system roles, custom roles, rank hierarchy, SSO / password+email code / biometric unlock, step-up for dangerous actions, append-only `admin_audit_log`, PII masking behind `users.pii`, owner immutable by trigger | Data classification tiers, per-user financial-data guard, break-glass grants, roles for product / data-AI / compliance, permission-matrix editor, access reviews |
| User 360 | `admin_user_overview`, tabs Overview / Activity / Billing / Tools / Notes, notes, suspend, entitlement and limit overrides, notify, delete (owner only) | AI usage and credits tab, lifecycle timeline, device list, support history inline, diagnostics snapshot |
| Support | `support_tickets`, `support_ticket_messages`, `admin_user_notes`, SupportView, staff reply | No ticket is ever created by the app. No SLA, macros, assignment rules, user-visible inbox, merge/duplicate, triage |
| Feedback | Settings > Help > `POST /api/feedback` creates a Linear issue directly | Bypasses the support desk; nothing persisted if Linear fails; hard-coded team and label IDs; user email sent to Linear; only bug / feature; no device or version context; no status back to the user |
| Analytics | `app_analytics_daily`, `analytics_touch`, `app_activity_days`, `admin_retention`, `admin_overview`, `admin_metrics_cache` + pg_cron | Acquisition source, onboarding and activation funnels, paywall funnel, revenue, segments, per-platform/plan cuts, event taxonomy, consent flags |
| AI | `ai_usage_events`, `ai_usage_daily`, `ai_chats`, `ai_reservations`, quota windows (5h/24h/7d), per-chat limits, plan limits + per-user overrides, feature switches | No money: no price book, no cost per call, no credits wallet, no margin policy, no spend guardrail. Two limits flagged `enforced:false` |
| Monetization | `plans` (only `free`), `user_entitlements`, loyalty tables, flags, platform settings, `GET /api/entitlements/me` | Payment provider, webhooks, revenue facts, paywall events, store-driven trials, promo codes |
| Reliability | SMS pipeline health view, push health, 2 Vercel crons | No error tracking, uptime probe, health endpoint, alerting or status page |
| Linear | `.mcp.json`, direct call in `/api/feedback`, an inactive local launchd bot | A real integration: outbox, retries, two-way status sync, config UI |

Live DB facts: 44 auth users, about 27 MB, instance `t4g.nano`, `max_connections = 60`; recently IO-starved. Any new write path or heavy read can hurt it. Available but not installed: `pgaudit`, `pg_partman`, `pgmq`. Installed: `pg_stat_statements`, `pg_cron`, `pgcrypto`, `supabase_vault`, `pg_trgm`.

## 2. Design principles

1. Postgres is the system of record, not the analytics engine. Raw events live at most 7 days in daily partitions, then are rolled up and dropped.
2. Precompute, then read. No portal screen scans a base table on page load.
3. Milestones instead of event scans: funnels run on `user_milestones` (about 20 rows per user).
4. One round trip per action: multi-step server logic is a single SQL function.
5. Batch and back-pressure writes: clients buffer and flush; the server inserts a batch in one statement; per-user and global caps drop excess.
6. Every new table ships with a retention rule, an index review and an owner.
7. Everything privileged goes through the portal. Portal reads use a dedicated Postgres role with `statement_timeout` and a connection cap.
8. Third parties get the minimum: ticket numbers and pseudonymous IDs, never emails, SMS text or amounts.
9. Extend, do not rebuild: permission catalog, guard, audit log, metrics cache, entitlement resolver and quota gateway stay.

## 3. Portal information architecture

| Group | Views | Audience |
|---|---|---|
| Home | Role-aware dashboard: widgets chosen by permission | Everyone |
| Users | Directory, User 360 (profile, entitlement, AI usage + credits, support history, devices, timeline, notes, actions) | Support, Growth, Finance |
| Support | Triage inbox, Tickets, Feedback board, Macros, SLA and queues, Integrations (Linear) | Support, Product, Engineering |
| Growth | Acquisition, Funnels, Retention and cohorts, Segments, Broadcasts, Referrals and promo codes | Growth, Product |
| Monetization | Plans and memberships, Revenue, Paywall and experiments, Loyalty, Credits and promos | Finance, Growth |
| AI | Usage and cost, Credits, Price book and margin policy, Quality, Datasets, Model routing | Finance, Data/AI, Engineering |
| Reliability | Uptime, Errors and releases, API performance, SMS pipeline, Crons and queues, Database health | Engineering |
| Data | Metric definitions, Consent stats, Export jobs | Data/AI, Product, Compliance |
| Governance | Team and roles (matrix editor), Access grants, Audit log, Security, Data-subject requests, Retention settings | Owner, Admin, Compliance |

## 4. Access model, roles and data protection

### 4.1 Data classification

| Tier | What | Who | Control |
|---|---|---|---|
| T0 | Aggregates and counts | Any staff with the view permission | Role |
| T1 | Per-user behavior under a hashed id: activity, funnel position, AI units, plan | Growth, Product, Data/AI, Finance | Role + analytics schema only |
| T2 | Identity: full email, phone, city, name | `users.pii` | Role; audit on unmasked view |
| T3 | Financial content: transactions, balances, budgets, goals, debts, raw SMS text, receipts | Active access grant for that user | Break-glass (4.3) |
| T4 | Secrets: tokens, password hashes, keys, SMS ingest tokens | Nobody in the portal | Owner-only in Supabase |

### 4.2 Roles by department

New permissions (do not rename existing): `analytics.users` (T1), `users.financial` (T3, grant required), `ai.cost.view`, `ai.cost.manage`, `ai.credits.grant`, `ai.credits.grant.large`, `ai.datasets.view`, `ai.datasets.export`, `growth.view`, `broadcasts.request`, `broadcasts.approve`, `reliability.view`, `integrations.manage`, `dsr.manage`, `data.definitions.edit`. New system roles: `product`, `data_ai`, `compliance`; split `support_agent` (L1) and `support_lead` (L2) limits; an editable permission matrix in Team and roles. Staff can only manage people and roles ranked below them and only hand out permissions they hold; owner immutable; `users.delete` owner-only. Credit grants have per-role caps in `platform_settings`.

Capability summary (Owner / Admin / Support L1 / Support L2 / Engineering / Finance / Growth / Product / Data-AI / Compliance / Viewer):
- Analytics T0: all except Support. Analytics T1: Owner, Admin, Finance, Growth, Product, Data-AI.
- Unmask PII: Owner, Admin, Support L2, Compliance. Financial content (T3): Owner; Admin with a reason (logged, no second approver); Support L2 by requesting a grant; nobody else.
- Support reply: L1 reply, L2 manage. User tools: L2, Engineering, Admin, Owner. Limits, credits, entitlements: Finance, Admin, Owner; L2 capped; Growth promos only. Suspend/restore: L2, Admin, Owner. Delete user: Owner only.
- Billing and revenue: Finance, Admin, Owner; Growth and Product view. AI cost, price book, margin: Finance, Admin, Owner; Engineering and Data-AI view. AI datasets and quality: Product, Data-AI, Admin, Owner; Compliance review.
- Flags, platform, maintenance: Engineering, Admin, Owner. Reliability: Engineering, Admin, Owner. Broadcasts: Growth and Product request, Admin/Owner approve.
- Staff and roles: Owner, Admin (below own rank). Audit log: Owner, Admin, Compliance. Data-subject requests: Owner, Admin, L2, Compliance.

### 4.3 Break-glass grants for T3

`admin_access_grants (id, staff_id, target_user_id, scope 'financial'|'sms'|'receipts', reason, ticket_id, requested_at, approved_by, approved_at, expires_at, revoked_at)`. Staff request with a reason and ticket; Owner approves; Admin self-approves with a mandatory reason. A grant lasts 30 minutes, extendable once. While active the T3 tabs appear; every T3 read writes an audit row (`pii.financial.read`). T3 reads are one function per tab, bounded by LIMIT and a statement timeout, and check a live grant in SQL. Users are told: every T3 read adds a line to the user's activity feed ("Support viewed your account on <date> for ticket #N"). Expiry is enforced by comparing `expires_at` on every call.

### 4.4 Locking Supabase to the owner

1. Only the owner in the Supabase organization. 2. MFA on Supabase, Vercel, GitHub, Google Cloud, Apple, Google Play, Linear. 3. Rotate the `service_role` key; keep it only in Vercel production env vars. 4. Dedicated roles: `portal_reader` (SELECT on analytics views and rollups, `statement_timeout 5s`, connection cap) and `portal_actor` (EXECUTE on a fixed list of `admin_*` / `support_*` functions); the raw service role only for cron and webhooks. 5. `pgaudit` on DDL, role and T3 reads. 6. Fix advisor warnings (see review: do not revoke `anon` on `app_client_gate`). 7. Quarterly access review page.

## 5. Analytics foundation (first-party)

Layers: app buffered events > `POST /api/events` batch > `analytics.events_raw` (daily partitions, 7-day TTL) > nightly rollups (pg_cron, small batches) > `user_milestones`, `fact_activity_daily`, `fact_funnel_daily`, `fact_ai_daily`, `fact_revenue_daily`, `user_dim` > `admin_metrics_cache` (portal reads only this) > export of closed days to a warehouse (Phase 6).

Pseudonymization: `pid = HMAC_SHA256(user_id, key)`, key in Supabase Vault, readable only by rollup functions. Re-identification is a separate audited T2 action. Consent: `analytics_consent` (default on, visible toggle) and `ai_improvement_consent` (default off). Deletion removes the user from `user_dim`, `user_milestones` and every fact keyed by `pid`.

Event taxonomy `domain.object_action`, one registry in `src/lib/analytics/events.ts` with shared Zod validation and `schema_version`: Acquisition (`app.first_open`, `web.landing_view`), Auth, Onboarding (`onboarding.step_viewed`, `onboarding.completed`), Activation (`expense.first_added`, `sms.enabled`, `budget.first_created`, `account.first_added`, `goal.first_created`), Engagement, Monetization (`paywall.viewed`, `purchase.completed`, `trial.started`, `subscription.canceled`), Quality (`ai.response_rated`, `sms.parse_corrected`), Support. Milestones are about 15 names.

Funnels, cohorts, acquisition, segments: core funnel Install > First open > Signup > Onboarding complete > First expense > SMS enabled > Budget created > Retained D7 > Paywall viewed > Trial started > Paid, each step a `count(*)` over `user_milestones`. Retention extends `admin_retention` into D1/D7/D30 and weekly curves with segment filters, computed nightly (never live: 17 s at 50K users). Acquisition captured once, first-party (store, `utm_*`, install referrer, invite code); no ATT prompt needed. Segments are saved rules over `user_dim`, evaluated nightly into a table. Volume: about 0.9M events a month at 1,000 MAU; per-user cap 500 events a day and a global kill switch flag.

## 6. Support, feedback and Linear

Flow: in-app Help > `POST /api/support/submit` (auth, rate limited, size capped; context: app version/build, platform, OS, device, locale, route, plan, optional breadcrumbs and screenshot) > one SQL function creates ticket + first message + outbox rows > user sees "Ticket #123" and a status in an in-app Inbox. Triage is async: rules, then a cheap LLM classifier if unsure, then duplicate detection (`pg_trgm`), low confidence goes to a Needs-triage queue. Routing: support/billing/account to Support queue; bug to Linear (Bug) automatically; feature request to the Feedback board (votes), to Linear at 10 votes or on PM promotion. Linear status changes come back by webhook and notify the user.

Data model (additive): `support_tickets` gains `kind`, `area`, `severity`, `triage_state`, `triage_confidence`, `duplicate_of`, `linear_issue_id`, `linear_issue_url`, `app_version`, `platform`, `context jsonb`, `votes`, `sla_first_response_due`, `sla_resolution_due`. New: `support_ticket_attachments`, `feedback_votes`, `support_macros`, `integration_outbox (idempotency_key unique, status, attempts, next_attempt_at, last_error)`, `integration_settings`. RLS: users read only their own tickets and messages; staff access stays service-role through portal routes; user replies via an API route.

Linear: outbox worker (cron every 1 to 5 min, `FOR UPDATE SKIP LOCKED`, 20 rows, exponential backoff, dead-letter), mapping kind/severity/area, portal link and ticket number (never the user's email), idempotency key = ticket id, signed webhook `/api/webhooks/linear` with a loop guard, config UI (`integrations.manage`), Sentry-to-Linear natively. Retire `/api/feedback` after clients migrate.

Portal support features: triage inbox with confidence badges, bulk reassign/merge, SLA timers and breach alerts, macros, internal notes, User 360 inside every ticket, one-click actions (grant trial days, reset AI window, resend verification, force-sync, push test, regenerate SMS token), CSAT, weekly digest.

## 7. AI economics

Price book `ai_price_book (provider, model, kind, in/cached/out usd per mtok, audio usd per min, effective_from/to, source_note)`, versioned and edited in the portal (`ai.cost.manage`). Cost captured at settle time into `cost_usd_micro` on `ai_usage_events` and the daily rollup, plus a daily `fx_egp_per_usd` table. Verify the Gemini tier terms (no training on prompts) before collecting content at scale.

Credits (monthly plan allowance + optional top-up packs): keep today's units as the meter; `1 credit = N units` in `platform_settings`. Append-only `ai_credit_ledger` and a fast `ai_credit_balances` read; burn order expiring allowance, promo, purchased. Allowance expires at month end; purchased after 12 months. Do not write a ledger row per AI call: upsert per user per day per feature and debit balances inside the existing settle function. The 5h/24h/7d windows stay as abuse ceilings; credits are the monetization meter.

Margin policy: 60% minimum per plan after store fees. `price >= expected_AI_cost / (1 - store_fee - target_margin) + infra_per_user` (example: $1.00 cost, 15% fee, 60% margin gives a $4.00 floor). `target_margin`, `store_fee`, `safety_buffer` editable with history; realized margin per plan shown; alert after 2 weeks below target.

Guardrails: global daily spend cap, degrade to the cheaper model at 80%, disable non-essential AI surfaces at 100% and alert; per-user anomaly alert (over 5x the plan median or above p99). AI Economics pages: cost per day by model and feature, per active and per paying user, margin by plan and cohort, top spenders, denial counts, latency and failure rate, forecast. Per-user actions with reason, audit and role caps. Flip `enforced:true` on `budget_plans_max` and `sms_accounts_max` only when the app enforces them.

## 8. Reliability, uptime and error alerting

Health: `GET /api/health` (shallow) and `GET /api/health/deep` (one cheap DB query, one cache read, rate limited, no secrets). Uptime: Better Stack or Checkly with probes on web `/`, `/api/health`, auth, `/api/sms/health`, a daily AI synthetic call, dead-man heartbeats per cron, and a public status page at `status.buddget.app`. Errors: Sentry for server, web bundle and Capacitor, source maps in CI per release `app.buddget@<version>+<build>`, PII scrubbed; Sentry-to-Linear. API performance: Vercel Observability + log drain; SLOs 99.5% availability, p95 under 800 ms, SMS ingest success above 98%. The portal Reliability view reads cached fetches (60 to 120 s). Alerts: error spike, new issue in latest release, uptime failure, cron missed, DB connections above 70%, AI cost cap at 80%, ticket SLA breach, queue backlog. Runbooks in `docs/runbooks/`.

## 9. Database protection rules

1. Capacity first: upsize compute, use the pooler in transaction mode, take a clean `pg_stat_statements` baseline before any Phase 3 write path ships.
2. Partition and drop, do not delete (`pg_partman` or a small partition cron).
3. Timeouts: `portal_reader` and `portal_actor` get `statement_timeout 5s` (reports 15s), `lock_timeout 2s`, capped connections; list endpoints are keyset-paginated with a hard max page.
4. Scheduled jobs are small and serialized: one day or partition each, advisory locks, off-peak (Cairo night), logged to `job_runs`, time-budgeted. Split `housekeeping()` so one slow job cannot block the rest.
5. Caches show their age; manual refresh is rate limited.
6. No Realtime for the portal; poll at 60 s or on focus.
7. Review gate for every migration: retention rule, index plan with EXPLAIN, rows per month, RLS stance; run `get_advisors` after each.
8. Outbox over fan-out for Linear, email and push (batches of 20, backoff, concurrency 1 to 2).
9. Warehouse trigger: events above 5M a month, rollups above 5 minutes, or ad-hoc SQL needed.
10. Read replica only if portal reads still compete after caching.

## 10. Roadmap

- **Phase 0, safety net (~1 week):** lockdown, advisor review, compute upsize, pooler check, `pg_stat_statements` baseline, `/api/health`, uptime probes, Sentry with release tracking, alert routing, status page. Done when a test alert reaches the owner's phone, a test error appears in Sentry with the right release, and no one else has Supabase access.
- **Phase 1, access model and governance (~2 weeks):** tiers, permissions, roles, matrix editor, role caps; `admin_access_grants`, `portal_reader` / `portal_actor`, T3 snapshot function, audit rows and user-feed notices; mask or gate SMS content; `pgaudit`; access review page; data-subject request tooling. Done when a Support L1 test account cannot read financial content by any route and every T3 read produces an audit row.
- **Phase 2, support, feedback, triage, Linear (~3 weeks).** Done when a submitted bug becomes a ticket in seconds and a Linear issue within 5 minutes with no email in it, closing it resolves the ticket and notifies the user, and a Linear outage loses nothing.
- **Phase 3, analytics foundation (~4 weeks).** Done when core funnel and D1/D7/D30 render from cache in under 1 second, analytics DB writes are lower than today, and deleting a test user removes them from every analytics table.
- **Phase 4, AI economics (~3 weeks).** Done when real usage shows a cost in USD and EGP per day, a credit grant is debited atomically with usage, and the spend cap degrades models in staging.
- **Phase 5, monetization analytics (~2 weeks; needs billing first):** RevenueCat or store webhooks into `billing_events` and `user_entitlements`, `fact_revenue_daily`, MRR, trials, conversion, churn, LTV, realized margin, paywall funnel.
- **Phase 6, AI quality loop and scale (ongoing):** quality view, de-identified exports for opted-in users, warehouse export, read replica, portal SSO, SOC 2-style controls.

## 11. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Analytics build or buy | Build first-party |
| 2 | Error tracking | Sentry (Crashlytics optional, off) |
| 3 | Uptime vendor | Better Stack or Checkly (final pick at Phase 0) |
| 4 | Credit model | Monthly allowance + optional top-ups; allowance expires monthly, purchased after 12 months |
| 5 | AI gross margin | 60% minimum per plan after store fees |
| 6 | Admin and T3 | Admin full access with a logged reason; everyone else needs a grant |
| 7 | Tell users about staff views | Yes, activity-feed line with ticket number |
| 8 | Analytics consent | Product analytics on with a toggle; AI-improvement use off until opt-in; legal wording confirmed locally (PDPL, GDPR) before Phase 3 |
| 9 | Linear auto-creation | Bugs automatic; features at 10 votes or PM promotion; support issues only on escalation |
| 10 | Compute upgrade | Yes, before any Phase 3 write path |
| 11 | Public feedback board | In-app, read-only for users; no public web roadmap yet |

Defaults for unspecified numbers (editable later): grant length 30 minutes extendable once; Support L2 credit grant up to 500 per user per month, Finance and Admin uncapped with a reason, any grant above 5,000 needs the Owner; analytics cap 500 events per user per day, raw retention 7 days; spend guardrail 80% degrade / 100% disable; ticket SLA first response 24 h (urgent 4 h), resolution 5 days; quarterly access review.

## 12. Risks and open items

Privacy law (pseudonymized data is still personal data; deletion must reach analytics, exports and backups-on-restore; update the privacy policy before Phase 3; re-verify "raw SMS text is not permanently retained" against `sms_corpus` and `sms_parse_log`). Store billing prerequisite for Phase 5 and top-ups. LLM triage can be wrong (advisory, confidence threshold, human override). Third-party data (Linear, Sentry, uptime, LLM vendors) need privacy-policy lines and DPAs. Scope: 12 to 16 lazy-loaded views, each with a guard test in the existing pg harness. Unverified: Supabase plan features for pgaudit / pg_partman / project-scoped roles, Vercel log drains and cron frequency, vendor pricing, Gemini tier terms.
