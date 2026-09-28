## Building with Buddget

Buddget is a personal-finance app (expenses, income, budgets, debts, savings, AI SMS parsing) that
ships as a web PWA and as iOS/Android Capacitor shells. **Design mobile-first**: the real surface is a
390×844 phone. Centre wide layouts with `max-w-2xl mx-auto px-4`.

### Setup

**No provider is required.** Components read their locale from a context that already defaults to the
full English dictionary, and app state from a Zustand store that needs no wrapper. Drop any component
straight into a page. `LocaleProvider` is exported if you specifically want Arabic.

Store-reading components (`KPICard`, `BudgetRing`, the `Dashboard*` heroes) start from an empty store,
so their figures render as zeros unless the data arrives through props. **Prefer the props** — check
the component's `.d.ts`.

### Styling idiom: Tailwind utilities + CSS custom properties

Buddget styles everything with **Tailwind v4 utility classes**, and every colour goes through a CSS
variable in an arbitrary-value utility. Write `bg-[var(--color-brand-card)]`, never `bg-[#111118]`.

| Purpose | Tokens |
|---|---|
| Surfaces | `--color-brand-bg` (page) · `--color-brand-card` · `--color-brand-elevated` (inputs, chips) · `--color-brand-border` |
| Text | `--color-brand-text-primary` · `--color-brand-text-secondary` · `--color-brand-text-muted` |
| Brand | `--color-brand-primary` (the FILL for buttons/FAB) + `--color-brand-on-primary` (what goes on it) · `--color-brand-primary-bright` (identity teal — decorative/chart/icon only) · `--color-brand-primary-ink` (teal TEXT) · `--color-brand-primary-soft` |
| Accents | `--color-brand-red` (+`-hover`, `-soft`, `-text`) · `--color-brand-green` (+`-hover`, `-soft`) · `--color-brand-gold` · `--color-brand-amber` (+`-soft`) · `--color-brand-focus` |
| Category ramp | `--color-cat-1` … `--color-cat-6` (charts, category chips) |
| Elevation | `--shadow-sm` · `--shadow-md` · `--shadow-lg` |
| Radius | buttons/inputs **12px** (`rounded-xl`) · cards **16px** (`rounded-2xl`) · sheet tops **24px** (`rounded-3xl`) · chips `rounded-full` |

**Semantics are fixed** — do not re-assign them: **teal = the brand and every primary action**;
**red = destructive and over-budget alerts ONLY**, never a primary CTA; green = income, received,
success; amber = warning, late; gold = investment. Outflow amounts are plain text, not red — red
is reserved so that when it appears, it means something.

Two traps worth stating:
1. On `Button` and `Badge`, **`variant="default"` is the solid brand-TEAL fill and is the primary
   CTA**; `variant="destructive"` is a softer red *tinted* style. That is the opposite of the usual
   shadcn reading.
2. **`--color-brand-primary-bright` (`#12B0A0`) cannot carry text** — white on it is 2.71:1. It is
   the identity teal for chart marks, icon glyphs and decorative fills only. The button FILL is
   `--color-brand-primary`; put `--color-brand-on-primary` on it. For teal *text* and links use
   `--color-brand-primary-ink`.

Hand-written utilities beyond stock Tailwind: `font-mono-numbers` (JetBrains Mono, `unicode-bidi:
isolate` — use on **every** amount, date and percentage), `font-heading`, `glass-card`, `prose-rtl`, and
`safe-area-top|bottom|start|end|x` for Capacitor insets.

Dark mode is **class-based** (`.dark` on an ancestor), not `prefers-color-scheme`. Dark is the primary
theme in practice — check both.

### Non-negotiables

- Every form input, select and trigger is **48px tall** (`h-12`). No tap target under **44×44px**.
- Cards/sheets `rounded-2xl` (16px); inputs/buttons `rounded-xl` (12px); chips/badges `rounded-full`.
- **Never use a pig for savings.** The canonical savings glyph is Lucide `Coins`. `PiggyBank` is
  banned product-wide and must not be reintroduced in any icon set or picker.
- **No notification bell on native.** The mobile header is avatar + greeting only.
- Arabic runs with `dir` staying LTR, so use **logical properties everywhere**: `ms-/me-/ps-/pe-`,
  `text-start/text-end` — never `ml-/pl-/text-left`.
- Amounts are `tabular-nums` and pre-formatted by the caller; components take formatted strings.
- Never hand-roll a transaction row — compose `TransactionRow`.

### Where the truth is

Read `_ds/<folder>/styles.css` and its `@import` closure for the real token values, and each
component's `<Name>.prompt.md` and `<Name>.d.ts` for its API. The `.d.ts` files carry the original
JSDoc — trust them over any summary.

### Idiomatic composition

```jsx
<div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[18px]">
  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
    Spent this month
  </p>
  <p className="mt-2 flex items-baseline gap-2">
    <span className="font-mono-numbers text-[34px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
      4,820.00
    </span>
    <span className="text-sm font-medium text-[var(--color-brand-text-muted)]">SAR</span>
  </p>
  <Button className="mt-4 w-full">Add expense</Button>
</div>
```
