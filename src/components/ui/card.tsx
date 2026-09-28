import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * The app-wide card surface.
 *
 * Before this existed, 93 places across 78 files re-declared
 * `rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]`
 * inline, in inconsistent property order and with drifting radii. This is that
 * surface, once.
 *
 * It is **polymorphic on purpose**. The surface is not always a `<div>`: settings
 * and notifications put it on a `<ul>` with `divide-y`, and several rows put it on
 * a `<button>`. A Card that hardcoded `<div>` would produce invalid
 * `<div>`-inside-`<ul>` markup and silently drop the divider styling, so pass
 * `render` to change the host element:
 *
 * ```tsx
 * <Card render={<ul />} padding="none" divide>…</Card>
 * <Card render={<button type="button" />} interactive>…</Card>
 * ```
 */
const cardVariants = cva(
  "border bg-clip-padding transition-colors",
  {
    variants: {
      variant: {
        /** The standard surface: card fill on the page background. */
        default: "border-[var(--color-brand-border)] bg-[var(--color-brand-card)]",
        /** One step up — for a card sitting on another card. */
        elevated: "border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]",
        /** Borderless, for grouping without drawing a box. */
        plain: "border-transparent bg-transparent",
        /** Brand-tinted, for a promoted or selected surface. */
        brand: "border-transparent bg-[var(--color-brand-primary-soft)]",
        /**
         * Full-bleed list surface: edge-to-edge with only top/bottom rules. This is
         * the ledger's day-group geometry (expenses, income, debts, savings).
         */
        list: "rounded-none border-x-0 border-y border-[var(--color-brand-border)] bg-[var(--color-brand-card)]",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        /** The design system's standard card padding. */
        lg: "p-[18px]",
      },
      radius: {
        /** 16px — the design system's card radius. */
        default: "rounded-2xl",
        /** 12px — matches controls, for compact inline cards. */
        sm: "rounded-xl",
        none: "rounded-none",
      },
      /** Raises the surface off the page. Cards are flat by default. */
      elevation: {
        none: "",
        sm: "shadow-[var(--shadow-sm)]",
        md: "shadow-[var(--shadow-md)]",
        lg: "shadow-[var(--shadow-lg)]",
      },
      /** Hairline rules between children — for `<ul>` and stacked rows. */
      divide: {
        true: "divide-y divide-[var(--color-brand-border)]",
        false: "",
      },
      /** Press affordance. Use when the card itself is the tap target. */
      interactive: {
        true: "cursor-pointer text-start outline-none hover:border-[var(--color-brand-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55 active:translate-y-px",
        false: "",
      },
    },
    compoundVariants: [
      // The list surface spans the full width, so a corner radius would be wrong.
      { variant: "list", class: "rounded-none" },
    ],
    defaultVariants: {
      variant: "default",
      padding: "lg",
      radius: "default",
      elevation: "none",
      divide: false,
      interactive: false,
    },
  }
)

function Card({
  className,
  variant,
  padding,
  radius,
  elevation,
  divide,
  interactive,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          cardVariants({ variant, padding, radius, elevation, divide, interactive }),
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "card", variant, interactive },
  })
}

export { Card, cardVariants }
