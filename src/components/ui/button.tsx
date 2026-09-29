"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        /** Solid red fill for a committing destructive action (delete confirmations).
         *  `destructive` above is the softer tinted style for lower-stakes removes. */
        "destructive-solid":
          "bg-[var(--color-brand-red)] text-white hover:bg-[var(--color-brand-red-hover)]",
        /**
         * Solid green fill. Reserved for confirming that MONEY CAME IN — "Received",
         * "Assign", "Full". Green is the income semantic, so this is not a general
         * affirmative: the ordinary confirm is `default` (teal).
         */
        success:
          "bg-[var(--color-brand-green)] text-white hover:bg-[var(--color-brand-green-hover)]",
        /** A control sitting on Flow's teal band: translucent fill in the band's text colour. */
        onBand:
          "border-[var(--flow-band-mix)] bg-[var(--flow-band-mix)] text-[var(--flow-band-fg)] hover:bg-[color-mix(in_oklab,var(--flow-band-fg)_30%,transparent)]",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",

        /* ── Brand sizes (Buddget) ────────────────────────────────────────────
           The sizes above are shadcn's desktop density and top out at h-9 (36px),
           under this app's 44px minimum tap target — which is exactly why most
           call sites hand-rolled their own button instead of using this one.
           These three are the real app sizes; prefer them on touch surfaces. */

        /** 44px — the minimum tap target. Compact rows, inline actions. */
        touch: "h-11 gap-2 rounded-xl px-4 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        /** 48px — the standard form control height, matching inputs. */
        cta: "h-12 gap-2 rounded-xl px-5 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        /** 48px, full width — the committing action at the foot of a sheet. */
        "cta-block":
          "h-12 w-full gap-2 rounded-xl px-5 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        /** 44×44 icon-only — the minimum square tap target. */
        "icon-touch": "size-11 rounded-xl [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /**
     * Shows a spinner and blocks further presses. Also sets `aria-busy`, so the
     * wait is announced rather than only drawn — a dozen call sites previously
     * swapped the label to "Saving…" and left assistive tech with no signal.
     */
    loading?: boolean
    /** Replaces the label while loading, e.g. "Saving…". The spinner shows either way. */
    loadingText?: string
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {loading && loadingText ? loadingText : children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
