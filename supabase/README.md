# Supabase setup (Buddget)

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **URL** and **publishable** key into `.env.local` for native builds (see `.env.example`). Put the **secret** key on **Vercel** only (`SUPABASE_SECRET_KEY`), not in `.env.local`.
3. In the **SQL Editor**, run migrations in order:

   1. [`migrations/001_init_auth_finance_analytics.sql`](./migrations/001_init_auth_finance_analytics.sql)  
   2. If you previously ran an older `001` without analytics rate limiting, also run [`migrations/003_analytics_insert_rate_limit.sql`](./migrations/003_analytics_insert_rate_limit.sql) (safe to run even on a fresh DB).

4. Under **Authentication → Providers → Email**:
   - Turn **Email** on.
   - Enable **email + password** (users create a password in Buddget; there is no passwordless / magic-link login in the app).
   - If you use **Confirm email**, new users enter the **6-digit code** in the **auth modal** (`verifyOtp` with type `signup`). Disable or avoid relying on magic links for signup confirmation — see templates below.

5. Under **Authentication → URL configuration**:
   - **Site URL:** your real app origin (production: `https://buddget.app`).
   - **Redirect URLs:** include `http://localhost:3000/**` (dev) and `https://buddget.app/**` (production).  
   **`/auth/callback`** is still used for **password recovery** (Supabase sends a reset link by default) and any OAuth flows you add later. Add **`https://buddget.app/auth/callback`** and **`https://buddget.app/auth/callback?next=/reset-password/confirm`** (or `/**`) so **`resetPasswordForEmail`** and PKCE exchange work.

6. **Email templates (OTP, not magic link for signup):**  
   - Edit the **Confirm signup** (and related) templates so they emphasize **`{{ .Token }}`** and remove or hide magic-link CTAs if you do not want links.  
   - Buddget does **not** call `signInWithOtp` for login — only **email + password** for sign-in, and **OTP** only when the user must confirm their email after **Create account**.  
   - **Forgot password** uses Supabase’s recovery email, which typically still contains a **link** (Supabase limitation); that link should open your app and hit `/auth/callback` if you keep the default redirect.

After that, sign-in, onboarding, cloud sync, analytics, and admin survey tools will work against your project.
