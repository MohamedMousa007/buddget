# CLAUDE_CONTEXT.md — Buddget System Snapshot
> Updated: 2026-10-16 (migrations section + native CI); other sections may lag. Re-generate after major architecture changes.

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

## Database — Migration Log (latest repo file 0121 = Budget v2: plan status/intent/origin, line block/links/due_day/essential/locked, `budget_plan_activations`, `buddgy_memories`, `profiles.financial_profile`; previous 0119; goals v3 = 0116 funding + goal_allocation_runs, 0117 business category, 0118 plan_start, 0119 goal alert switches; subscriptions redesign = 0114 + 0115)

Live project: `ydihurtbcnoflhormgzi` (ap-southeast-1). Verified 2026-10-16: live tables/columns == `src/lib/supabase/database.types.ts` (41 tables). Latest applied: `income_sources_sort_order` (= repo 0109). Repo file numbers and applied migration names drift (e.g. repo 0108 = applied `0104_debt_payments_funded_from_savings`); compare schema, not names. Session-start check: `list_migrations`, then regenerate types and diff.

Native builds: GitHub Actions only (`ios-release.yml` -> TestFlight, `android-release.yml` -> APK on Drive), dispatched by `scripts/native-release.sh`, on demand ("build and upload apps" = both). One-time secrets: `scripts/ci-secrets.sh`.

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
| Budget | `/budget-setup`, `/budget-history` | `budget_plans`, `budget_categories`, `budget_subcategories`, `budget_plan_activations`, `budget_feedback`, `buddgy_memories` |
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

## Budget v2 (planning brain)

Seven blocks (bills, subscriptions, debts, everyday, safety, goals, grow) in three chapters (must pay, live, secure). One plan is active and applies to every month; `budget_plan_activations` logs which plan governed which cycle and `planForMonth` resolves it (past months keep their plan). Plans are created only by the user (draft, ready, archived).
- **Domain** (`src/lib/budget/`, pure and tested): `engine.buildPlan` (deterministic waterfall), `validate.repairDraft`, `ops.applyOps` (set/add/remove/move/rename/lock on known line ids), `infoGaps` (studio question graph), `templates`, `budgetAi` (prompts, schemas, parsers), `planView.buildPlanView` (read model), `comparePlans`, `activations`.
- **UI** (`src/components/features/budget/`): `BudgetPlanPage` (Plan / This month), `PlanDeck`, `builder/` (`CreateChooser`, `ManualBuilder`), `studio/` (`StudioPage` card by card, `ReviewPage`), `sheets/` (Line, AddLine, Activate, Compare, PastPlan, Adjust). Copy lives in `src/lib/i18n/budgetPage/*` (en/ar, not in the typed dictionary).
- **AI**: `POST /api/budget/ai` ops `build` (refines the engine draft: rationale, amounts within 25%) and `adjust` (text to ops). The model never writes: the client previews, applies via the store and logs `budget_feedback`. Per-user daily cap is in-memory per instance. Every AI failure falls back to the engine draft or manual editing.
- **Memory**: `buddgy_memories` synced through `buddgyMemories` in the finance store (cap 40, dedupe); chat auto-learns unless `buddgyLearning` is off; budget proposals need an explicit toggle. Manager in `/settings/ai`.
- **Month close**: `monthClose.buildClose` + `useMonthClose` turn the finished cycle (if the active plan governed it, spend existed, first 15 days of the new cycle) into a summary and up to 4 raise/lower proposals; `MonthCloseCard`/`MonthCloseSheet` on the Plan tab; done cycles in `budgetClosedCycles` (settings store, device-local).
- **Desktop**: at `lg` the Plan page is a two-column grid; `FlowStrip`, `InsightsChip` and `PlanRail` (all budgets, set active/continue, compare, new, history) sit in a sticky 22rem right rail; below `lg` the same elements stack as before.
- **Stress test**: `stressTest.stressPlan` (income down, bills up, everyday up; trims growth, then wants, then essentials to a floor; never locked/linked) shown read-only in `StressTestSheet` from the plan menu.
- **Not built yet**: per-line rollover, Studio "What I know" drawer, studio state persistence.

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
