'use client'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  // `after:` widens the *hit* area without widening the *visual* box, so a 32px
  // glyph can still satisfy the 44px tap-target rule. `relative` is on the base
  // because every size relies on it.
  'relative inline-flex shrink-0 items-center justify-center bg-clip-padding border border-transparent transition-colors outline-none select-none ' +
    'after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:min-h-[44px] after:min-w-[44px] after:content-[""] ' +
    'focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]/50 focus-visible:border-[var(--color-brand-focus)] ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:relative [&_svg]:z-[1]",
  {
    variants: {
      variant: {
        /** Default. No resting background — the icon carries the affordance. */
        ghost:
          'text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] hover:text-[var(--color-brand-text-primary)]',
        /** A resting surface, for an icon sitting on a card or a photo. */
        tinted:
          'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-sunken)]',
        /** Reads as a control rather than decoration — toolbars, steppers. */
        outlined:
          'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]',
        /** Teal fill. The one primary icon action on a surface (add, confirm). */
        solid:
          'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-primary-hover)]',
        /** Soft teal. An AI / assistant affordance, or a highlighted-but-not-primary action. */
        brand:
          'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-primary-soft)]/70',
        /** Destructive, tinted. Row-level deletes. */
        danger:
          'text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/10',
        /** A glyph over a photo or a dark scrim, where tokens would disappear. */
        overlay: 'bg-black/45 text-white backdrop-blur-sm hover:bg-black/60',
        /**
         * A glyph on a brand-coloured surface — a teal sheet header, a gradient
         * hero card. Always white, because the surface underneath is already the
         * brand colour and a token would vanish into it.
         */
        onBrand: 'bg-white/15 text-white hover:bg-white/25',
      },
      size: {
        /** 32px visual, 44px hit area. Dense rows, chip dismissals. */
        sm: "size-8 [&_svg:not([class*='size-'])]:size-4",
        /** 44px — the standard icon button. */
        md: "size-11 [&_svg:not([class*='size-'])]:size-5",
        /** 48px — matches a form control, for a lone action beside an input. */
        lg: "size-12 [&_svg:not([class*='size-'])]:size-[22px]",
        /** 80px — a hero control that is the whole point of the screen: the
         *  biometric unlock, the record button. Not for toolbars. */
        xl: "size-20 [&_svg:not([class*='size-'])]:size-8",
      },
      shape: {
        /** Squared with the app's control radius. */
        default: 'rounded-xl',
        round: 'rounded-full',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md', shape: 'default' },
  }
)

/**
 * An icon button must carry its own accessible name: there is no text to fall
 * back on, so omitting one leaves a screen reader announcing "button". Requiring
 * it in the type is the only way to keep that from happening again — 30 of the
 * hand-rolled icon buttons this component replaces had no name at all.
 */
type Labelled =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never }

export type IconButtonProps = Omit<
  React.ComponentProps<'button'>,
  'aria-label' | 'aria-labelledby'
> &
  VariantProps<typeof iconButtonVariants> &
  Labelled & {
    /**
     * Drops the 44px hit overlay. Only for genuinely desktop-density surfaces —
     * the admin tables — where controls sit closer together than 44px and the
     * overlays would overlap, turning a precise click into a misclick.
     *
     * Never pass this on a surface a phone will show. It is deliberately explicit
     * so that `grep hitArea={false}` lists every exception.
     */
    hitArea?: boolean
  }

/**
 * The app-wide icon-only button — close, back, edit, delete, chevron, overflow.
 *
 * This exists because {@link Button} is built around a text label (gap, inline
 * padding, min-width) and fighting that at every call site is what produced 118
 * hand-rolled `<button>` elements, 30 of them unlabelled and 27 below the 44px
 * tap minimum.
 *
 * Every size keeps a **44px hit area** even when the glyph is smaller, via an
 * `after:` overlay rather than real padding — so `size="sm"` stays visually dense
 * in a tight row without becoming an accessibility failure.
 *
 * That overlay is the one thing to be careful with: at `sm` it reaches about 6px
 * past the glyph on every side. Harmless for a button with space around it, but it
 * means two adjacent `sm` buttons overlap (space them `gap-1`+), and a **destructive**
 * `sm` button sitting beside other content can swallow a tap meant for the content.
 * Prefer `md`, whose overlay exactly matches its 44px box, for anything that deletes.
 *
 * ```tsx
 * <IconButton aria-label={t.common.close} onClick={onClose}><X /></IconButton>
 * <IconButton aria-label="Delete" variant="danger" size="sm"><Trash2 /></IconButton>
 * ```
 */
export function IconButton({
  className,
  variant,
  size,
  shape,
  hitArea = true,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      data-slot="icon-button"
      type={type}
      className={cn(
        iconButtonVariants({ variant, size, shape }),
        !hitArea && 'after:hidden',
        className
      )}
      {...props}
    />
  )
}

export { iconButtonVariants }
