'use client'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { HIT_AREA } from '@/lib/ui/hitArea'

const optionChipVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 border font-semibold whitespace-nowrap transition-colors outline-none select-none ' +
    'focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)] ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      size: {
        /** 36px — a dense filter row. The tap area is still 44px (invisible overlay). */
        sm: HIT_AREA + ' h-9 rounded-full px-3 text-[0.8125rem]',
        /** 40px — the usual chip, with a 44px invisible tap area. */
        md: HIT_AREA + ' h-10 rounded-full px-3.5 text-[0.8125rem]',
        /** 44px, squared — reads as a segment in a row of equal choices. */
        segment: 'h-11 flex-1 rounded-xl px-3 text-[0.8125rem]',
      },
      selected: {
        true: 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]',
        false: 'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)]',
      },
      /**
       * What the chip is sitting ON, which decides its unselected fill.
       *
       * `elevated` (default) is for a chip inside a sheet or a card — and that is
       * the default because `ModalShell` panels are `--color-brand-card`, so a
       * card-filled chip there is white on white, visible only by its border.
       * `card` is for a chip on the page background instead.
       *
       * It only affects the unselected state; a selected chip is always the teal tint.
       */
      surface: {
        elevated: '',
        card: '',
      },
    },
    compoundVariants: [
      {
        selected: false,
        surface: 'elevated',
        class: 'bg-[var(--color-brand-elevated)] hover:bg-[var(--color-brand-sunken)]',
      },
      {
        selected: false,
        surface: 'card',
        class: 'bg-[var(--color-brand-card)] hover:bg-[var(--color-brand-elevated)]',
      },
    ],
    defaultVariants: { size: 'md', selected: false, surface: 'elevated' },
  }
)

export type OptionChipProps = Omit<React.ComponentProps<'button'>, 'aria-pressed'> &
  VariantProps<typeof optionChipVariants> & {
    /**
     * What the chip does, which decides how the highlighted state is announced:
     * - `'toggle'` (default) — it turns something on and off, so `selected` is
     *   announced as `aria-pressed`.
     * - `'trigger'` — it opens a sheet or menu. Here `selected` only means "a
     *   filter is applied", which is not a pressed state, so nothing is announced;
     *   pass `aria-expanded` / `aria-haspopup` yourself.
     */
    as?: 'toggle' | 'trigger'
  }

/**
 * A single choice in a row of choices — a filter chip, a "this month / 3 / 6 / 12"
 * selector, a status picker.
 *
 * Selection is announced with `aria-pressed`, not colour alone: the teal fill is
 * the only visual difference between chosen and unchosen, so without it a screen
 * reader gets nothing. Derived from `selected` so a call site cannot forget it.
 *
 * Use {@link SegmentedControl} instead when the choices are mutually exclusive AND
 * fixed in number — it manages arrow-key navigation as one radio group. This is for
 * chips that scroll, toggle independently, or are generated from data.
 *
 * ```tsx
 * <OptionChip selected={v === 'weekly'} onClick={() => set('weekly')}>Weekly</OptionChip>
 * ```
 */
export function OptionChip({
  className,
  size,
  selected,
  surface,
  as = 'toggle',
  type = 'button',
  ...props
}: OptionChipProps) {
  return (
    <button
      data-slot="option-chip"
      type={type}
      aria-pressed={as === 'toggle' ? Boolean(selected) : undefined}
      className={cn(optionChipVariants({ size, selected, surface }), className)}
      {...props}
    />
  )
}

export { optionChipVariants }
