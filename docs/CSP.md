# Content-Security-Policy

`src/middleware.ts` mints a per-request nonce and sets `script-src 'self' 'nonce-…' 'strict-dynamic'` (built by `src/lib/security/csp.ts`, unit-tested). The root layout reads it from the `x-nonce` request header so the theme-init script and Next's own bootstrap scripts carry it. Public website routes (`/en`, `/ar`) use `SITE_CSP` instead (static, `unsafe-inline`).

## Why app pages are dynamic
Next only stamps the nonce on its inline hydration scripts at request time. A statically rendered page has no nonce, so its inline scripts would be blocked under `strict-dynamic`; the only ways to make them static are `unsafe-inline` or per-build script hashes (Next's flight payload scripts differ per page and build, so they cannot be pre-hashed). Both weaken or destabilise the CSP, so `/offline`, `/legal/*`, `/privacy`, `/terms` stay dynamic. Revisit only with a dedicated root layout plus an accepted CSP trade-off.

## Regression checks
- `npm run test` (includes `src/lib/security/csp.test.ts`).
- Against a production server: `npm run build && npx next start -p 3055`, then `node scripts/csp-check.mjs http://localhost:3055`. Fails if any route lacks the CSP header or nonce, has `unsafe-inline`/`unsafe-eval` in `script-src`, or has an inline `<script>` without the nonce.
