# Public website

Static marketing site in English and Arabic, served from the same Next app as the product.

- **Routes:** `src/app/(site-en)/en/[[...slug]]` and `src/app/(site-ar)/ar/[[...slug]]`. Each group has its own root layout (static `lang`/`dir`, no app providers). The product lives in `src/app/(app)`.
- **`/`:** middleware shows the website to visitors with no Supabase session cookie (rewrite to `/ar` or `/en` by `Accept-Language`); signed-in users get the app. The PWA `start_url` is `/flow`. See `src/lib/site/entry.ts`.
- **Native builds:** both site groups are stashed in `scripts/capacitor-build.mjs`; the website never ships in the Capacitor bundle.
- **Content:** `src/lib/site/content/{en,ar}.ts` (typed by `types.ts`). Arabic is simple Modern Standard Arabic to match the app. Route list, titles and descriptions derive from content in `routes.ts`; metadata, hreflang and JSON-LD in `seo.ts`.
- **Real screens:** `public/site/screens/*.webp`, captured from the running app with a seeded demo account. Retake from the store build before launch.
- **Config:** `src/lib/site/config.ts` — social URLs (empty hides the link), store links (null shows the beta list), support email.
- **Reviews:** `src/lib/site/content/reviews.ts`. `REAL_REVIEWS` empty hides the section; samples render only when `NEXT_PUBLIC_SITE_SAMPLE_REVIEWS=1`.
- **Leads:** `POST /api/site/lead` writes beta-list and contact messages to `site_leads` (service role only, RLS on, honeypot and rate limit).
- **Analytics:** cookieless first-party counters. `SiteAnalytics` sends one view per page and one click per `data-track="cta"` element to `POST /api/site/event`, which bumps a daily row in `site_stats` (no IP, no user agent; Do Not Track and Global Privacy Control are honoured). Read it with SQL on `site_stats`.
- **Share images:** `public/og-en.png` and `public/og-ar.png`, 1200x630, set per language in `seo.ts`.
- **CSP:** site pages use `SITE_CSP` (inline scripts allowed because static pages carry no nonce); the app keeps its nonce CSP.
- **Claims:** the automation figure on the home page is beta data and needs a refresh and date before launch.

## Two-host mode (root domain = website, my.buddget.app = product)
Set `NEXT_PUBLIC_MY_HOST=my.buddget.app` (optionally `NEXT_PUBLIC_MARKETING_HOST`, default is the parent domain). Logic in `decideSiteRoute` (`src/lib/site/entry.ts`), covered by tests. On the root domain: `/` is the website, `/api`, `/auth/callback`, `/legal`, static files stay, app routes redirect to the app host; `www` redirects to the root; the app host redirects website paths back and serves a closed `robots.txt`. Unset, nothing changes.
