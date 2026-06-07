# CLAUDE_CONTEXT.md — Buddget System Snapshot
> Auto-generated: 2026-06-07. Re-generate after major architecture changes.

---

## Architecture

| Layer | Stack |
|---|---|
| Framework | Next.js 16.2.1 (React 19, TypeScript, Webpack) |
| Styling | Tailwind CSS v4 + CSS custom properties |
| State | Zustand v5 (`src/lib/store/types.ts`) |
| Backend | Supabase (PostgreSQL + RLS + Auth) |
| AI | Groq SDK (chat/parse), custom `/api/ai` proxy |
| Web deploy | Vercel (SSR + API routes) |
| Native | Capacitor 8 — iOS + Android shells |
| Native web layer | Static export (`out/`) served inside WebView |
| Native API calls | All `/api/*` → `https://buddget.app` via `NEXT_PUBLIC_API_BASE_URL` |
| Push (web) | Web Push / VAPID → `push_subscriptions` table |
| Push (native) | Firebase Cloud Messaging → `push_tokens` table, fan-out via `firebase-admin` |
| PWA | `next-pwa` + service worker + Web App Manifest |

**Dual-mode rule:** the app runs as both a full Next.js SSR web app (Vercel) and a Capacitor static-export native app. Code that depends on `window` / browser APIs must guard with `isNative()` (`src/lib/native/isNative.ts`) or `typeof window !== 'undefined'`.

---

## Database — Migration Log (44 total)

Latest 3 migrations (applied; do not re-apply):

| File | What it does |
|---|---|
| `0044_sms_parsing.sql` | `sms_parse_log` table — AI SMS/notification parser ledger with rate-limit view `sms_parse_today` |
| `0043_push_tokens.sql` | `push_tokens` table — FCM/APNS native device tokens (distinct from web VAPID `push_subscriptions`) |
| `0042_onboarding_v2.sql` | Adds `onboarding_version int` + `lite_mode bool` to `profiles`; backfills existing users to version 1 |

Full migration history in `supabase/migrations/`. Generated types: `src/lib/supabase/database.types.ts`.

**Schema rules:**
- All tables use `uuid` PKs (`gen_random_uuid()`)
- All user-scoped tables have RLS enabled with `auth.uid() = user_id` policies
- Service-role-only inserts (e.g. `sms_parse_log`) have no INSERT policy — enforced at API layer

---

## Design Tokens

### Brand Colors

```css
/* Light mode (:root) */
--color-brand-red:            #E50914;
--color-brand-red-hover:      #C5070F;
--color-brand-gold:           #D4A017;
--color-brand-green:          #18A349;
--color-brand-green-hover:    #12843B;
--color-brand-amber:          #E08800;
--color-brand-bg:             #F5F5F7;
--color-brand-card:           #FFFFFF;
--color-brand-elevated:       #F0F0F4;
--color-brand-border:         #D4D4DC;
--color-brand-text-primary:   #1A1A24;
--color-brand-text-secondary: #5A5A72;
--color-brand-text-muted:     #8A8AA0;

/* Dark mode (.dark) */
--color-brand-red:            #E50914;   /* unchanged */
--color-brand-red-hover:      #F40612;
--color-brand-gold:           #F5C842;
--color-brand-green:          #1DB954;
--color-brand-green-hover:    #25D067;
--color-brand-amber:          #FF9F0A;
--color-brand-bg:             #0A0A0F;
--color-brand-card:           #111118;
--color-brand-elevated:       #1A1A24;
--color-brand-border:         #2A2A38;
--color-brand-text-primary:   #FFFFFF;
--color-brand-text-secondary: #CFCFE0;  /* bumped from #A0A0B8 — WCAG AA fix */
--color-brand-text-muted:     #9898B0;
```

### Semantic / Shadcn tokens

```css
/* Light */
--background: #F5F5F7;   --foreground: #1A1A24;
--card: #FFFFFF;          --card-foreground: #1A1A24;
--primary: #E50914;       --primary-foreground: #FFFFFF;
--secondary: #F0F0F4;     --muted: #F0F0F4;
--muted-foreground: #5A5A72;
--border: #D4D4DC;        --input: #D4D4DC;
--ring: #E50914;          --destructive: #E50914;

/* Dark */
--background: #0A0A0F;   --foreground: #FFFFFF;
--card: #111118;          --muted: #1A1A24;
--muted-foreground: #CFCFE0;
--border: #2A2A38;        --input: #2A2A38;
```

### Border Radius

Base `--radius: 0.75rem`. Derived scale:

| Tailwind class | CSS var | Value |
|---|---|---|
| `rounded-sm` | `--radius-sm` | `0.45rem` |
| `rounded-md` | `--radius-md` | `0.6rem` |
| `rounded-lg` | `--radius-lg` | `0.75rem` (base) |
| `rounded-xl` | `--radius-xl` | `1.05rem` |
| `rounded-2xl` | `--radius-2xl` | `1.35rem` |
| `rounded-3xl` | `--radius-3xl` | `1.65rem` |
| `rounded-4xl` | `--radius-4xl` | `1.95rem` |

Card convention: `rounded-xl`. Button default: `rounded-lg`.

### Glassmorphism

```css
/* .glass-card — light */
background: rgba(255, 255, 255, 0.7);
border: 1px solid rgba(0, 0, 0, 0.06);
backdrop-filter: blur(12px);

/* .dark .glass-card */
background: rgba(26, 26, 36, 0.8);
border: 1px solid rgba(255, 255, 255, 0.06);
```

### Typography

| Role | CSS var | Tailwind class |
|---|---|---|
| Body / UI | `var(--font-sans)` | `font-sans` |
| Headings | `var(--font-heading)` | `font-heading` |
| Mono / numbers | `var(--font-mono)` | `font-mono` / `.font-mono-numbers` |

`.font-mono-numbers` adds `font-variant-numeric: tabular-nums`.
Arabic locale: `html[data-locale='ar']` prepends `var(--font-sans-ar)` to sans + heading stacks.

### Tailwind color aliases (use these in JSX)

```
bg-brand-bg / bg-brand-card / bg-brand-elevated
bg-brand-red / bg-brand-green / bg-brand-gold / bg-brand-amber
text-brand-red / text-brand-green / text-brand-gold / text-brand-amber
text-[--color-brand-text-primary] (or text-foreground)
text-[--color-brand-text-secondary] (or text-muted-foreground)
border-[--color-brand-border] (or border-border)
```

---

## Component Patterns

### Button (`src/components/ui/button.tsx`)
Built on `@base-ui/react/button` + CVA.

| Size | Height | Notes |
|---|---|---|
| `xs` | `h-6` (24px) | `px-2`, icon-xs: `size-6` |
| `sm` | `h-7` (28px) | `px-2.5`, icon-sm: `size-7` |
| `default` | `h-8` (32px) | `px-2.5`, icon: `size-8` |
| `lg` | `h-9` (36px) | `px-2.5`, icon-lg: `size-9` |

For 44px mobile touch targets, use a larger wrapper or `size-11` icon button.

Variants: `default` (brand-red filled) · `outline` · `secondary` · `ghost` · `destructive` (red tinted) · `link`

### Input (`src/components/ui/input.tsx`)
Built on `@base-ui/react/input`.
- `h-8`, `rounded-lg`, `border-input`, `dark:bg-input/30`
- Focus ring: `ring-3 ring-ring/50` (brand-red)
- Date/month inputs auto-call `showPicker()` on click

### Sheet / Modal spacing
- Inner padding: `p-4` (mobile) / `p-6` (desktop)
- Always add `safe-area-bottom` on the scroll container for native

---

## Safe-Area Utilities

```
.safe-area-top     → padding-top: env(safe-area-inset-top)
.safe-area-bottom  → padding-bottom: env(safe-area-inset-bottom)
.safe-area-x       → padding-inline both axes
.native-scroll     → touch scrolling + overscroll-behavior-y: contain
.no-tap-highlight  → -webkit-tap-highlight-color: transparent
```

Native platform classes on `<body>`: `platform-native`, `platform-ios`, `platform-android`.

---

## Feature Inventory

| Domain | Routes | Key tables |
|---|---|---|
| Expenses | `/expenses` | `expenses` |
| Income | `/income` | `income_sources` |
| Budget | `/budget-setup` | `budget_plans`, `budget_categories`, `budget_subcategories` |
| Savings | `/savings` | savings tables |
| Debts | `/debts` | `debts`, `debt_payments` |
| Subscriptions | `/subscriptions` | `subscriptions` |
| Goals | `/goals` | `goals` |
| Reports | `/reports` | (aggregated queries) |
| SMS ingestion | `/api/sms/*` | `sms_events` (regex), `sms_parse_log` (AI) |
| Push notifications | `/api/push/*` | `push_subscriptions` (web), `push_tokens` (native) |
| Voice entry | `/api/voice/transcribe` | — |
| Receipt scan | `/api/receipt/scan` | — |
| AI budget planner | `/api/budget/regenerate` | `budget_feedback` |
| Onboarding | `/onboarding` | `profiles.onboarding_version`, `profiles.lite_mode` |
| Admin | `/admin`, `/api/admin/*` | `app_analytics_events`, `api_rate_limits` |
| Auth | `/auth/callback`, `/reset-password/*` | Supabase Auth + `profiles` |

---

## Capacitor Native Config

- App ID: `online.buddget` · Web dir: `out/`
- Allowed navigation: `buddget.app`, `*.buddget.app`, `buddget.online`
- Splash bg: `#0A0A0F` · Status bar: DARK `#0A0A0F`
- Local notification icon color: `#E50914`
- Preferences group: `group.online.buddget`
- iOS: `contentInset: always` · Android: `captureInput: true`

---

## Key File Map

| Purpose | Path |
|---|---|
| Global CSS + tokens | `src/app/globals.css` |
| Tailwind config | `tailwind.config.ts` |
| Store types | `src/lib/store/types.ts` |
| Supabase DB types | `src/lib/supabase/database.types.ts` |
| Supabase client | `src/lib/supabase/client.ts` |
| Native detection | `src/lib/native/isNative.ts` |
| API base URL | `src/lib/apiBase.ts` |
| Route middleware | `src/middleware.ts` |
| Capacitor config | `capacitor.config.ts` |
| Migrations | `supabase/migrations/` |
