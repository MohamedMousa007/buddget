# Supabase setup (Buddget)

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the URL, `anon` key, and `service_role` key into `.env.local` (see `.env.example`).
3. In the **SQL Editor**, run migrations in order:

   1. [`migrations/001_init_auth_finance_analytics.sql`](./migrations/001_init_auth_finance_analytics.sql)  
   2. If you previously ran an older `001` without analytics rate limiting, also run [`migrations/002_analytics_insert_rate_limit.sql`](./migrations/002_analytics_insert_rate_limit.sql) (safe to run even on a fresh DB).

4. Under **Authentication → Providers**, enable **Email** and your passwordless method (OTP / magic link).

5. Under **Authentication → URL configuration**:
   - **Site URL:** your real app origin (e.g. `https://your-app.vercel.app`). This must match where users open the app, or confirmation links will fail or open the wrong host.
   - **Redirect URLs:** add both:
     - `http://localhost:3000/**` (dev)
     - `https://your-app.vercel.app/**` (production)  
     The app sends magic links to **`/auth/callback`** with a `next` query (see `signInWithOtp` in `src/app/login/page.tsx`). Those URLs must be allowed here.

6. **Email templates (OTP + link):** Buddget uses `signInWithOtp`, so users get a **6-digit code** and often a **confirmation link** in the same email. In **Authentication → Email Templates**, ensure the template includes `{{ .Token }}` so the code is visible. If the link returns an error, double-check **Site URL**, **Redirect URLs**, and that you’re opening the link on the same environment (production vs localhost).

After that, sign-in, onboarding, cloud sync, analytics, and admin survey tools will work against your project.
