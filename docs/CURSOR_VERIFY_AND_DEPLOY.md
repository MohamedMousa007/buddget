# Verify issues & deploy (Cursor / Vercel)

Use this doc to **re-check** the original audit items and to **deploy** Buddget.

## 1. What was wrong (verification checklist)

| Issue | How to verify | What we did |
|-------|----------------|-------------|
| No `tailwind.config.ts` | `ls tailwind.config.ts` at repo root | Added `tailwind.config.ts` + `@config` in `src/app/globals.css` (Tailwind v4). Brand utilities: `bg-brand-bg`, `text-brand-red`, `font-heading`, etc. |
| PWA not wired | Search `next.config` for `next-pwa` | Wrapped config with `next-pwa`; `build` uses `next build --webpack` (Next 16 default Turbopack conflicts with PWA’s webpack hook). |
| Generic fonts | Open `src/app/layout.tsx` | `DM_Sans` (sans + heading vars) + `JetBrains_Mono` (`--font-mono`). Body: `font-sans`. |
| Bottom “More” friction | Open app on mobile width | Bottom nav is **5 items**: Home, Expenses, **+**, Debts, Reports. Income/Savings: **Sidebar** (desktop) + **Settings** links (mobile). |
| `importData` silent failures | Import bad JSON in Settings | `importData` **throws** user-facing `Error`s; Settings shows a **banner** (success / error). Zod issues summarized via `safeParse`. |
| `amountInBaseCurrency` caller-owned | Grep `addExpense(` | Store computes with `tryConvertCurrency`; type is `Omit<..., 'amountInBaseCurrency'>`. |
| `DEFAULT_DEBTS` `createdAt` | Read `useFinanceStore.ts` | Fixed ISO strings `2024-01-01T00:00:00.000Z`. |
| Missing AI settings | Read `AppSettings` in `types.ts` | `enableAI`, `aiProvider: 'gemini'` + defaults, Zod import schema, persist merge. Gemini uses server `GEMINI_API_KEY` only. |

## 2. Cursor prompts (Compiler / Agent)

**Verify only (read-only)**

> In `buddget/`, confirm: (1) `tailwind.config.ts` exists and `globals.css` has `@config`; (2) `next.config.ts` uses `next-pwa` and `package.json` build is `next build --webpack`; (3) `layout.tsx` uses DM Sans + JetBrains Mono variables; (4) `BottomNav.tsx` has five slots and no “More” sheet; (5) `importData` throws and Settings catches; (6) `addExpense` omits `amountInBaseCurrency` in the public type and sets it inside the store; (7) `AppSettings` includes AI fields. Report any drift.

**Re-apply PWA after dependency changes**

> Reinstall `next-pwa`, keep security `headers` in `next.config.ts`, ensure `disable: process.env.NODE_ENV === 'development'`, and keep `"build": "next build --webpack"`.

## 3. Deploy to Vercel

1. **Local:** `cd buddget && npm run build` — must finish with **0 errors**.
2. **Git:** Initialize repo if needed, commit, push to GitHub (`buddget` as project root — **Root Directory** in Vercel = `buddget` if the repo contains the monorepo folder).
3. **Vercel:** New Project → import repo → Framework **Next.js** → Root Directory **`buddget`** (if applicable) → Deploy.
4. **Env vars:** Add the same keys as local `.env.local` for AI/rates if you use server routes.
5. **iOS install:** Safari → your URL → Share → **Add to Home Screen**.

## 4. PWA / icons

- `public/manifest.json` and `public/icons/icon-192.png` / `icon-512.png` should exist.
- `next-pwa` writes `public/sw.js` (and workbox chunks) on **production** builds; entries are in `.gitignore` — Vercel generates them each deploy.

## 5. Optional: silence Next “multiple lockfiles” warning

If your machine has a `package-lock.json` **above** this project, either remove it or set in `next.config.ts`:

```ts
import path from 'path'
import { fileURLToPath } from 'url'

// ESM alternative: path.dirname(fileURLToPath(import.meta.url))
outputFileTracingRoot: path.join(__dirname),
```

(Use the pattern that matches your `next.config` module system.)
