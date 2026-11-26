# Architecture diagrams (as of 2026-11-26)

Current state only. No future architecture is drawn: nothing in the audit justifies new infrastructure (see [roadmap, Phase D](performance-optimization-roadmap.md#phase-d-advanced-scaling-trigger-gated)). Sources: `_work/W1a-inventory.md` and the live catalog reads in `_work/W2e-live-db-evidence.md`.

## 1. System overview

```mermaid
flowchart LR
  subgraph Clients
    WEB[Web app<br/>Next.js client]
    NAT[iOS / Android<br/>Capacitor static export]
    ADM[Admin portal<br/>admin.buddget.app]
    SITE[Marketing sites<br/>EN / AR]
  end

  subgraph Vercel["Vercel (fra1) - one Next.js 16 deployment"]
    PROXY[src/proxy.ts<br/>host rewrite, session refresh,<br/>public-API limiter]
    API[117 route handlers<br/>main 43 · admin 45 · auth 9<br/>cron 9 · site 8 · webhook 3]
    VC[Vercel cron x7]
    DC[(Next data cache<br/>unstable_cache, tagged)]
  end

  subgraph Supabase["Supabase tzioppxwsljhlglyducm (eu-central-1)"]
    AUTH[GoTrue Auth]
    REST[PostgREST<br/>+ db_pre_request gate]
    PG[(Postgres 17<br/>121 tables, RLS on all)]
    CRON[pg_cron x16 + pg_net]
    ST[(Storage<br/>support-attachments, avatars)]
    RT[Realtime<br/>broadcast nudge only]
  end

  subgraph External
    AI[Gemini / Groq]
    RC[RevenueCat]
    MAIL[Resend]
    PUSH[FCM / APNs]
    MKT[FX / gold / Finnhub]
    OBS[Sentry]
  end

  WEB & NAT -->|supabase-js: sync RPCs, CRUD under RLS| REST
  WEB & NAT -->|auth| AUTH
  WEB & NAT -->|apiFetchAuth| PROXY
  ADM --> PROXY
  SITE --> PROXY
  PROXY --> API
  API -->|service-role client| REST
  API --> DC
  API --> AI & RC & MAIL & PUSH & MKT & OBS
  VC --> API
  CRON -->|pg_net POST| API
  REST --> PG
  CRON --> PG
  RC -->|webhook| API
  PG -.-> RT -.-> WEB & NAT
```

Key facts: main app and admin share one deployment, one database and one service-role key (no load isolation). The native apps ship the web bundle locally and call the same API. Receipt photos never leave the device.

## 2. Main app data flow

```mermaid
sequenceDiagram
  participant D as Device (zustand store, persisted)
  participant R as PostgREST (RLS, authenticated)
  participant A as Next API (service role)
  participant P as Postgres

  D->>D: cache-first boot (render persisted store)
  D->>R: sync_changed_since(cursor)
  R->>P: EXISTS per table on (user_id, updated_at)
  alt changes
    D->>R: sync_pull_v2(p_since)
    R->>P: jsonb_agg per table (no row cap)
  else cursor > 60 days, first sign-in, or delta error
    D->>R: full pull of all live rows (F-10)
  end
  D->>R: upsert dirty rows (one request per table, no batch cap, F-15)
  D->>A: /api/entitlements/me (sign-in and billing events)
  A->>P: entitlements_state(p_user): upkeep writes + ~20 reads (F-01)
  D->>A: /api/flags, AI routes (plans + flags read on each call, F-03)
  Note over A,P: SMS ingest: /api/sms/parse claims with one insert, then reads payment_methods 6-9x (F-21)
```

## 3. Admin portal flow

```mermaid
sequenceDiagram
  participant S as Staff browser (15 s response cache)
  participant G as guardAdmin
  participant A as /api/admin/*
  participant P as Postgres (service role)

  S->>G: request + session cookie / X-Admin-Session
  G->>P: admin_sessions (hash), last_seen update (<= 1/min)
  G->>G: GoTrue getUserById (HTTP)
  G->>P: admin_staff, admin_roles (5 s per-instance cache)
  G->>A: permission check per op
  A->>P: admin_user_directory (ILIKE + count + OFFSET, F-13)
  A->>P: admin_metrics_cache, refreshed inline if > 15 min (F-12)
  A->>P: admin_audit_log insert (after the action, result unchecked, F-08)
```

## 4. Core entity relationships (user-owned finance tables)

A subset of the 121 tables, drawn from live column and index names. Every table below carries `user_id -> auth.users(id)` (84 of 121 tables do). Soft delete (`deleted_at`) exists on 21 tables, `updated_at` on 42.

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : id
  AUTH_USERS ||--|| USER_SETTINGS : user_id
  AUTH_USERS ||--o| USER_ENTITLEMENTS : user_id
  AUTH_USERS ||--o| LOYALTY_ACCOUNTS : user_id
  AUTH_USERS ||--o{ PAYMENT_METHODS : user_id
  AUTH_USERS ||--o{ EXPENSES : user_id
  AUTH_USERS ||--o{ INCOME_EVENTS : user_id
  AUTH_USERS ||--o{ INCOME_SOURCES : user_id
  AUTH_USERS ||--o{ SAVINGS_ACCOUNTS : user_id
  AUTH_USERS ||--o{ DEBTS : user_id
  AUTH_USERS ||--o{ GOALS : user_id
  AUTH_USERS ||--o{ SUBSCRIPTIONS : user_id
  AUTH_USERS ||--o{ BUDGET_PLANS : user_id
  AUTH_USERS ||--o{ SMS_PARSE_LOG : user_id
  AUTH_USERS ||--o{ AI_USAGE_EVENTS : user_id
  AUTH_USERS ||--o{ NOTIFICATIONS : user_id

  PAYMENT_METHODS ||--o{ EXPENSES : payment_method_id
  PAYMENT_METHODS ||--o{ INCOME_EVENTS : payment_method_id
  PAYMENT_METHODS ||--o{ SAVINGS_ACCOUNTS : held_in_payment_method_id
  INCOME_SOURCES ||--o{ INCOME_EVENTS : template_id
  SAVINGS_ACCOUNTS ||--o{ SAVINGS_TRANSACTIONS : account
  SAVINGS_ACCOUNTS ||--o{ INCOME_EVENTS : linked_savings_account_id
  DEBTS ||--o{ DEBT_PAYMENTS : debt
  DEBTS ||--o{ EXPENSES : linked_debt_id
  SUBSCRIPTIONS ||--o{ EXPENSES : linked_subscription_id
  BUDGET_PLANS ||--o{ BUDGET_CATEGORIES : plan
  SMS_PARSE_LOG ||--o| EXPENSES : sms_log_id
  SMS_PARSE_LOG ||--o| INCOME_EVENTS : sms_log_id
  SMS_PARSE_LOG ||--o| DEBT_PAYMENTS : debt_payment_id
  SMS_PARSE_LOG ||--o| SAVINGS_TRANSACTIONS : savings_transaction_id
```

Schema-wide counts (live): 168 foreign keys (98 `ON DELETE CASCADE`, 68 `SET NULL`, 2 `NO ACTION`), 0 unindexed foreign keys, 22 unique and 202 check constraints, 24 enums, 405 indexes, 0 tables without a primary key, RLS enabled on all 121 tables.
