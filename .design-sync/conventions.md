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
| Accents | `--color-brand-red` (+`-hover`, `-text`) · `--color-brand-green` (+`-hover`) · `--color-brand-gold` · `--color-brand-amber` · `--color-brand-focus` |
| Radius | `--radius` (12px base) → `--radius-sm|md|lg|xl` |

**Semantics are fixed** — do not re-assign them: red = expense / outflow / primary CTA and destructive;
green = income, received, success; amber = warning, late; gold = premium, price.

A trap worth stating: on `Button` and `Badge`, **`variant="default"` is the solid brand-red fill and is
the primary CTA**; `variant="destructive"` is a softer red *tinted* style. That is the opposite of the
usual shadcn reading.

Hand-written utilities beyond stock Tailwind: `font-mono-numbers` (JetBrains Mono, `unicode-bidi:
isolate` — use on **every** amount, date and percentage), `font-heading`, `glass-card`, `prose-rtl`, and
`safe-area-top|bottom|start|end|x` for Capacitor insets.

Dark mode is **class-based** (`.dark` on an ancestor), not `prefers-color-scheme`. Dark is the primary
theme in practice — check both.

### Non-negotiables

- Every form input, select and trigger is **48px tall** (`h-12`). No tap target under **44×44px**.
- Cards/sheets `rounded-2xl`; inputs/buttons `rounded-xl`; chips/badges `rounded-full`.
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
