'use client'

import { cn } from '@/lib/utils'
import { rgba } from '@/lib/utils/color'

export interface AccentTileProps extends Omit<React.ComponentProps<'button'>, 'children'> {
  /**
   * The item's own colour — a category's, an income type's. Unlike every other
   * selectable primitive, this one is tinted by the item rather than by the brand,
   * because the colour is how the user recognises the item at a glance in a grid of
   * twenty. Selection is conveyed by that tint *plus* a matching border and a
   * colour-shift on the glyph, so it does not rest on hue alone.
   *
   * Must be a literal `#RRGGBB` — the tint goes through {@link rgba}, which parses
   * hex. A `var(--token)` here yields `rgba(NaN,NaN,NaN,…)` and the tile renders with
   * no fill and no border at all, which is silent rather than obvious. Both grids
   * that use this pass hex from `categoryGrid.ts`.
   */
  accent: string
  selected: boolean
  /** The glyph. It takes the accent when selected and goes muted when not. */
  icon: React.ReactNode
  label: string
  /**
   * Dashed border when unselected. Marks a tile that is not what it looks like —
   * the non-spend categories (top-up, ATM, FX), which move money rather than spend it.
   */
  dashed?: boolean
  /** A small mark in the corner, e.g. the transfer arrows on a non-spend category. */
  badge?: React.ReactNode
}

/**
 * A square icon-and-label tile in a picker grid — expense categories, income types.
 *
 * Both grids had derived the same `rgba(accent, .15)` fill and `rgba(accent, .55)`
 * border inline, so the tint and the selected border could drift apart. This is
 * that tile, once.
 *
 * It is a radio by role, so wrap the grid in `role="radiogroup"` with an
 * `aria-label`.
 *
 * ```tsx
 * <AccentTile accent={c.accent} selected={on} icon={<Icon />} label={c.label}
 *             dashed={c.nonspend} onClick={() => pick(c.id)} />
 * ```
 */
export function AccentTile({
  className,
  accent,
  selected,
  icon,
  label,
  dashed,
  badge,
  type = 'button',
  style,
  ...props
}: AccentTileProps) {
  return (
    <button
      data-slot="accent-tile"
      type={type}
      role="radio"
      aria-checked={selected}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all outline-none',
        'focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      style={{
        background: selected ? rgba(accent, 0.15) : 'var(--color-brand-elevated)',
        border: selected
          ? `1px solid ${rgba(accent, 0.55)}`
          : `1px ${dashed ? 'dashed' : 'solid'} var(--color-brand-border)`,
        ...style,
      }}
      {...props}
    >
      {badge}
      <span
        className="flex items-center [&_svg]:size-6"
        style={{ color: selected ? accent : 'var(--color-brand-text-muted)' }}
      >
        {icon}
      </span>
      <span
        className="whitespace-nowrap text-[0.625rem] font-semibold"
        style={{
          color: selected
            ? 'var(--color-brand-text-primary)'
            : 'var(--color-brand-text-secondary)',
        }}
      >
        {label}
      </span>
    </button>
  )
}

/**
 * The grid the tiles sit in: two rows, scrolling horizontally, 66x60 cells.
 *
 * Exported alongside the tile because both pickers had re-declared the same
 * `gridAutoFlow: column` / `repeat(2,60px)` / `66px` geometry, and a tile that
 * matches while its grid does not is still a broken row.
 *
 * ```tsx
 * <div role="radiogroup" aria-label={label} className={accentTileGridClass} style={accentTileGridStyle}>
 * ```
 */
export const accentTileGridClass = 'grid w-max gap-2'

export const accentTileGridStyle: React.CSSProperties = {
  gridAutoFlow: 'column',
  gridTemplateRows: 'repeat(2,60px)',
  gridAutoColumns: '66px',
}
