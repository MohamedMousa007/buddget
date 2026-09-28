'use client'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const selectableCardVariants = cva(
  'relative flex w-full border text-start transition-colors outline-none select-none ' +
    'focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]/50 ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      layout: {
        /** Icon, then a title and subtitle — a provider, an account, a currency. */
        row: 'min-h-[52px] items-center gap-3 rounded-2xl p-3.5',
        /** Icon above a label, for a grid of equal choices. */
        tile: 'flex-col items-center gap-2.5 rounded-2xl px-1.5 py-3.5 text-center',
        /** A compact row inside a scrolling list — a checkbox list of categories. */
        list: 'min-h-11 items-center gap-3 rounded-xl px-2.5 py-1.5',
      },
      selected: {
        true: 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]',
        false:
          'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] hover:bg-[var(--color-brand-elevated)]',
      },
    },
    defaultVariants: { layout: 'row', selected: false },
  }
)

export type SelectableCardProps = React.ComponentProps<'button'> &
  VariantProps<typeof selectableCardVariants> & {
    /**
     * How the choice behaves, which decides how it is announced:
     * - `'radio'` (default) — one of several, only one can be chosen.
     * - `'checkbox'` — independently toggleable, several can be chosen.
     * - `'action'` — not a choice at all; it opens something or adds something.
     *   Pass this for a card that navigates, so it is not announced as selectable.
     */
    as?: 'radio' | 'checkbox' | 'action'
  }

/**
 * A card-shaped choice — the currency rows, the provider picker, the savings-type
 * grid, the category checkbox list.
 *
 * The selected state is teal fill plus a teal border, and it is announced through
 * the matching ARIA role rather than left to colour: `radio` for a one-of-many
 * choice, `checkbox` for an independent toggle. That distinction matters to a
 * screen reader — "selected" and "checked" describe different affordances — and
 * getting it from a prop keeps 20-odd call sites from each deciding differently.
 *
 * A `radio` or `checkbox` role is only valid inside a group, so wrap the set in a
 * container with `role="radiogroup"` (or `role="group"` for checkboxes) and an
 * `aria-label`. Pass `as="action"` for a card that is not part of a choice set.
 *
 * ```tsx
 * <SelectableCard selected={cur === c.code} onClick={() => pick(c.code)}>…</SelectableCard>
 * <SelectableCard as="checkbox" layout="list" selected={on}>…</SelectableCard>
 * <SelectableCard as="action" layout="tile" onClick={openSheet}>…</SelectableCard>
 * ```
 */
export function SelectableCard({
  className,
  layout,
  selected,
  as = 'radio',
  type = 'button',
  ...props
}: SelectableCardProps) {
  const state =
    as === 'action'
      ? {}
      : as === 'checkbox'
        ? { role: 'checkbox' as const, 'aria-checked': Boolean(selected) }
        : { role: 'radio' as const, 'aria-checked': Boolean(selected) }

  return (
    <button
      data-slot="selectable-card"
      type={type}
      {...state}
      className={cn(selectableCardVariants({ layout, selected }), className)}
      {...props}
    />
  )
}

export { selectableCardVariants }
