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
| `npm run generate-icons` | No-op (icon set is maintained under `public/` — see below) |

## Stack

- **Next.js 16** (App Router), React 19, TypeScript  
- **Tailwind CSS v4** — tokens in `src/app/globals.css` + `tailwind.config.ts` (`@config`)  
- **Zustand** + `localStorage` persistence  
- **PWA** — `next-pwa` generates `public/sw.js` on production build (ignored in git). **Icons:** commit `public/favicon.ico` and `public/icons/` (`icon-16.png`, `icon-32.png`, `apple-touch-icon.png`, `apple-touch-icon.svg`) — wired in `src/app/layout.tsx` and `public/manifest.json`.  
- **Base UI** primitives under `src/components/ui/`

## Docs

- **Index:** [`docs/README.md`](docs/README.md) — links to all project docs  
- **Vercel deploy:** [`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md)  
- **Development & checklist:** [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)  
- **Next.js:** [nextjs.org/docs](https://nextjs.org/docs)

## Deploy (Vercel)

See **[`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md)**. Short version: push to GitHub → import repo on Vercel → set **Root Directory** only if the app is in a subfolder → add **`GEMINI_API_KEY`**, **`ADMIN_PIN`**, **`NEXT_PUBLIC_APP_URL`**.
