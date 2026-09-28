import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
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

        /* ── Status variants (Buddget) ───────────────────────────────────────
           Tinted fill + matching text, both sides token-driven so they track the
           theme. These replace the inline <span> badges the ledgers hand-rolled
           with hardcoded hex. */
        /** Income received, refunded, on track. */
        positive:
          "bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]",
        /** Late, due soon, partial. */
        warning:
          "bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]",
        /** Declined, missed, over budget. */
        negative:
          "bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]",
        /** Recurring, linked, automated — the brand tint. */
        brand:
          "bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]",
        /** Neutral metadata (one-time, manual). */
        muted:
          "bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]",
      },
      size: {
        default: "h-5 px-2 py-0.5 text-xs font-medium",
        /** Matches the ledger chips exactly. Deliberately smaller than `default`
         *  so adopting Badge in a TransactionRow does not grow its 60px rhythm. */
        xs: "px-2 py-[2.5px] text-[9.5px] font-extrabold uppercase tracking-[0.05em]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      size,
    },
  })
}

export { Badge, badgeVariants }
