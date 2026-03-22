# Deploy Buddget to Vercel (exact steps)

## Before you push

1. **Keep `package-lock.json` in sync** whenever you change `package.json` (e.g. new dependencies):
   ```bash
   cd buddget
   npm install
   # or, to refresh only the lockfile: npm install --package-lock-only
   ```
   CI uses `npm ci`, which fails if the lockfile is out of date.

2. **Build passes locally**
   ```bash
   npm ci
   npm run build
   ```

3. **Secrets stay out of git** — `.env.local` is gitignored. Never commit API keys.

4. **GitHub Actions `npm run build`** needs the same public Supabase vars as the app (so Next can build). In the repo: **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   (Same values as in Vercel / `.env.local`.) The workflow passes them into the build step automatically.

## 1. Push to GitHub

If this folder is already a git repo:

```bash
cd buddget
git status
git add -A
git commit -m "chore: ship Buddget for Vercel"
git branch -M main
```

**First time — add remote:**

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

**Already have `origin`:**

```bash
git push origin main
```

> If your GitHub repo should contain the **parent** folder (e.g. `Budget Manager/`) with `buddget/` inside, initialize git at that parent level instead and set Vercel **Root Directory** to `buddget` (see below).

## 2. Create the Vercel project

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub.
2. **Add New…** → **Project** → import the repo that contains this app.
3. **Root Directory**
   - If the repo root **is** this Next app → leave **`.`** (default).
   - If the app lives in a subfolder → set **Root Directory** to **`buddget`**.
4. **Framework Preset:** Next.js (auto).
5. **Build Command:** `npm run build` (default — uses `next build --webpack` from `package.json`).
6. **Install Command:** `npm install` or `npm ci` (Vercel default is fine).
7. Click **Deploy**.

## 3. Environment variables (Vercel dashboard)

**Project → Settings → Environment Variables** (add for *Production* at minimum):

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase **Project Settings → API**. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon public** key (same screen). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** key — **server only**, never `NEXT_PUBLIC_*`. Needed for admin user list & survey APIs. |
| `GEMINI_API_KEY` | Required for `/api/ai`. Get a key from [Google AI Studio](https://aistudio.google.com/apikey). |
| `ADMIN_PIN` | Strong secret for `/admin` (never use a placeholder like `1234` in production). |
| `NEXT_PUBLIC_APP_URL` | Your live URL, e.g. `https://your-app.vercel.app` (update after first deploy). |

Redeploy after changing env vars (**Deployments → … → Redeploy**).

**Supabase Auth (production):** In Supabase → **Authentication → URL configuration**, set **Site URL** to your Vercel URL and add that URL under **Redirect URLs** (e.g. `https://your-app.vercel.app/**`).

**Admin:** `/admin` requires a **signed-in Buddget user** (middleware) **and** the **ADMIN_PIN** in the app/API. Anonymous visitors cannot open the admin screen.

## 4. Smoke checks after deploy

Open your production URL:

- `/` loads.
- `/manifest.json` returns JSON.
- `/icons/icon-192.png` returns **200** (not 404).
- **Safari (iPhone):** Share → **Add to Home Screen** for PWA.

## 5. Optional: custom domain

**Project → Settings → Domains** → add your domain and follow DNS instructions.
