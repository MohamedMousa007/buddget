# Development

## Prerequisites

- Node 20+ (matches [CI](../.github/workflows/ci.yml))
- Copy [`.env.example`](../.env.example) to `.env.local` and fill values (see [supabase/README.md](../supabase/README.md))

## Commands

```bash
npm ci          # clean install (same as CI)
npm run dev     # dev server (webpack — required for next-pwa)
npm run lint
npm run test
npm run build   # must pass before deploy
```

## Quality checklist

Before merging or deploying, confirm:

- **Tailwind:** `tailwind.config.ts` exists; `src/app/globals.css` includes `@config` pointing at it.
- **PWA:** `next.config.ts` wraps config with `next-pwa`; `package.json` uses `next build --webpack` (Turbopack conflicts with the PWA webpack hook).
- **Fonts:** `src/app/layout.tsx` wires DM Sans (sans + heading) and JetBrains Mono.
- **Navigation:** `BottomNav` is five items; secondary routes via sidebar / settings on small screens.
- **Data import:** `importData` throws on invalid data; Settings surfaces errors (Zod via `safeParse`).
- **Expenses:** `addExpense` omits `amountInBaseCurrency` from the public payload; the store sets it via `tryConvertCurrency`.
- **AI settings:** `AppSettings` in `src/lib/store/types.ts` includes `enableAI` / `aiProvider` defaults; Gemini uses server-only `GEMINI_API_KEY`.

## CI and secrets

GitHub Actions runs `lint`, `test`, and `build`. The build needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as [repository secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions) (same values as Vercel / local).

## PWA artifacts

`next-pwa` generates `public/sw.js` and Workbox chunks on **production** builds. Those paths are gitignored; Vercel generates them each deploy. Commit `public/manifest.json` and `public/icons/icon-*.png` (or run `npm run generate-icons`).

## Deploy

See **[VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)**.

## Lockfile / monorepo

If a `package-lock.json` exists **above** this app, Next may warn about multiple lockfiles. This repo sets `outputFileTracingRoot` in `next.config.ts` to the app directory to prefer a single root.
