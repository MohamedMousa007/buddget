# Buddget

Personal finance app (Next.js): expenses, income, budgets, debts, savings, reports, and optional AI assistant.

## Scripts

| Command | Description |
|--------|---------------|
| `npm run dev` | Dev server (**webpack** — required with `next-pwa`) |
| `npm run build` | Production build (`next build --webpack`) |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run generate-icons` | Regenerate `public/icons/icon-192.png` & `icon-512.png` (PWA / manifest) |

## Stack

- **Next.js 16** (App Router), React 19, TypeScript  
- **Tailwind CSS v4** — tokens in `src/app/globals.css` + `tailwind.config.ts` (`@config`)  
- **Zustand** + `localStorage` persistence  
- **PWA** — `next-pwa` generates `public/sw.js` on production build (ignored in git). **Icons:** commit `public/icons/icon-192.png` & `icon-512.png`, or run `npm run generate-icons`.  
- **Base UI** primitives under `src/components/ui/`

## Docs

- **Vercel + Git — step-by-step:** [`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md)  
- **Verify checklist:** [`docs/CURSOR_VERIFY_AND_DEPLOY.md`](docs/CURSOR_VERIFY_AND_DEPLOY.md)  
- **Next.js:** [nextjs.org/docs](https://nextjs.org/docs)

## Deploy (Vercel)

See **[`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md)**. Short version: push to GitHub → import repo on Vercel → set **Root Directory** only if the app is in a subfolder → add **`GEMINI_API_KEY`**, **`ADMIN_PIN`**, **`NEXT_PUBLIC_APP_URL`**.
