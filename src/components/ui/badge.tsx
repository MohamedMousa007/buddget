import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",

        /** No colour of its own: the colour comes from `tone`. */
        none: "",
        /* Legacy status names, kept as aliases of `tone` (see STATUS_ALIAS). */
        positive: "",
        warning: "",
        negative: "",
        brand: "",
        muted: "",
      },
      /** Tinted fill + matching text, token-driven. Replaces the hand-rolled `rounded-full px-* py-*` pills. */
      tone: {
        brand: "bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]",
        positive: "bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]",
        warn: "bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]",
        negative: "bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]",
        /** Neutral metadata (one-time, manual). */
        neutral: "bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]",
        /** Counts and quiet facts on a page. */
        soft: "bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]",
        /** Same fill as `soft`, primary ink: the fact is the point. */
        ink: "bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]",
        /** On a tinted surface. */
        card: "bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)]",
        /** On a brand-filled surface. */
        onBrand: "bg-white/20 text-inherit",
        /** Placeholder for something that does not count. */
        dashed: "border-dashed border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)]",
      },
      size: {
        default: "h-5 px-2 py-0.5 text-xs font-medium",
        /** Matches the ledger chips exactly. Deliberately smaller than `default`
         *  so adopting Badge in a TransactionRow does not grow its 60px rhythm. */
        xs: "px-2 py-[2.5px] text-[0.59375rem] font-extrabold uppercase tracking-[0.05em]",
        /** Page pills: counts, "last 3", step labels. */
        sm: "px-2.5 py-1 text-[0.6875rem] font-bold",
        /** Fact chips with an icon. */
        md: "px-3 py-1.5 text-xs font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

/** The old status variant names resolve to a tone, so existing callers are unchanged. */
export const STATUS_ALIAS: Partial<Record<BadgeVariant, BadgeTone>> = {
  positive: "positive",
  warning: "warn",
  negative: "negative",
  brand: "brand",
  muted: "neutral",
}

/** Class list for a badge: `tone` wins, else a status-named variant maps to its tone. `bordered={false}` drops the 1px border so the pill does not grow. */
export function badgeClasses({
  variant = "default",
  tone,
  size = "default",
  bordered = true,
  className,
}: {
  variant?: BadgeVariant | null
  tone?: BadgeTone | null
  size?: VariantProps<typeof badgeVariants>["size"]
  bordered?: boolean
  className?: string
}) {
  const resolved = tone ?? (variant ? STATUS_ALIAS[variant] : undefined)
  return cn(badgeVariants({ variant: resolved ? "none" : variant, tone: resolved, size }), !bordered && "border-0", className)
}

function Badge({
  className,
  variant = "default",
  tone,
  size = "default",
  bordered = true,
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { bordered?: boolean }) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: badgeClasses({ variant, tone, size, bordered, className }),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      tone,
      size,
    },
  })
}

export { Badge, badgeVariants }
