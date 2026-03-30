<!-- BEGIN:nextjs-agent-rules -->
# Next.js in this repo

This project uses **Next.js 16** (App Router). APIs and conventions may differ from older training cutoffs. Before changing routing, `next.config`, or data fetching, read the installed docs under `node_modules/next/dist/docs/` or [nextjs.org/docs](https://nextjs.org/docs). Follow deprecation notices.

**Project docs:** [`docs/README.md`](docs/README.md) — deploy, development checklist, Supabase.

**Stack notes:** Production build must use `next build --webpack` (see `package.json`) because `next-pwa` hooks into webpack. Dev uses the same for consistency.

**Git default:** Implement and push on `dev` (see `.cursor/rules/deployment-protocol.mdc`). Production goes to `main` via PR only.
<!-- END:nextjs-agent-rules -->
