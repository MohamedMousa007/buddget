<!-- BEGIN:nextjs-agent-rules -->
# Next.js in this repo

This project uses **Next.js 16** (App Router). APIs and conventions may differ from older training cutoffs. Before changing routing, `next.config`, or data fetching, read the installed docs under `node_modules/next/dist/docs/` or [nextjs.org/docs](https://nextjs.org/docs). Follow deprecation notices.

**Project docs:** [`docs/README.md`](docs/README.md) — deploy, development checklist, Supabase.

**Stack notes:** Production build must use `next build --webpack` (see `package.json`) because `next-pwa` hooks into webpack. Dev uses the same for consistency.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Services overview

| Service | How to run | Notes |
|---------|-----------|-------|
| Next.js dev server | `npm run dev` | Runs on port 3000 with `--webpack` flag (required for `next-pwa`) |
| Supabase | Cloud-hosted | Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` |

### Quick reference

- **Lint / Test / Build / Dev commands** are in `package.json` scripts and [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
- **Environment variables:** Copy `.env.example` → `.env.local` and fill from injected secrets. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional: `GEMINI_API_KEY`, `ADMIN_PIN`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Package manager:** `npm` (lockfile: `package-lock.json`). Use `npm ci` for clean installs.

### Gotchas

- The dev server **must** use `--webpack` (already configured in `package.json`). Turbopack is incompatible with `next-pwa`.
- `next build` also requires `--webpack` for the same reason.
- Supabase env vars must be set even for build to succeed (they are referenced at build time). Placeholder values work if real credentials are unavailable, but auth/data features will fail.
- The app uses Node.js 22 in CI. Minimum compatible version is Node 20+.
