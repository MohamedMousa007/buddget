# Supabase setup (Buddget)

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the URL, `anon` key, and `service_role` key into `.env.local` (see `.env.example`).
3. In the **SQL Editor**, run migrations in order:

   1. [`migrations/001_init_auth_finance_analytics.sql`](./migrations/001_init_auth_finance_analytics.sql)  
   2. If you previously ran an older `001` without analytics rate limiting, also run [`migrations/002_analytics_insert_rate_limit.sql`](./migrations/002_analytics_insert_rate_limit.sql) (safe to run even on a fresh DB).

4. Under **Authentication → Providers**, enable **Email** and your passwordless method (OTP / magic link).
5. Under **Authentication → URL configuration**, set **Site URL** and **Redirect URLs** (include `http://localhost:3000/**` and your production URL + `/auth/callback` if used).

After that, sign-in, onboarding, cloud sync, analytics, and admin survey tools will work against your project.
