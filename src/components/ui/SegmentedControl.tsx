'use client'

import { useRef } from 'react'
import { HIT_AREA } from '@/lib/ui/hitArea'
import { nextSegmentIndex } from './segmentedNav'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Optional count shown after the label, e.g. a result count per segment. */
  count?: number
  /**
   * Optional leading glyph. Decorative only — the label already names the option,
   * so the icon is hidden from assistive tech rather than announced twice.
   */
  icon?: React.ReactNode
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Stretch each segment to fill the row. Default true — the usual mobile layout. */
  fill?: boolean
  /** Accessible name for the group, e.g. "Filter by direction". */
  ariaLabel: string
  /** `field` matches a 52px AmountField it sits beside (e.g. amount + unit); default is the 44px bar. */
  size?: 'default' | 'field'
  className?: string
}

/**
 * A single-select segmented control — the All / In / Out switch on Flow, and the
 * Savings / Investment switch.
 *
 * Built as a **radiogroup**, not tabs: it filters the content below rather than
 * swapping panels, so `role="tablist"` would promise a relationship to screen
 * readers that does not exist. Arrow keys move selection AND focus together,
 * matching native radio-group behaviour.
 *
 * The selected pill is a sibling element rather than a background on the button,
 * so it can animate between positions later without touching the markup.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fill = true,
  ariaLabel,
  size = 'default',
  className,
}: SegmentedControlProps<T>) {
  const group = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        const next = nextSegmentIndex(e.key, options.findIndex((o) => o.value === value), options.length)
        if (next === null) return
        e.preventDefault()
        onChange(options[next].value)
        group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
      }}
      className={cn(
        'inline-flex gap-0.5 border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-[3px]',
        size === 'field' ? 'h-[52px] rounded-[14px]' : 'rounded-xl',
        fill && 'w-full',
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Only the selected option is in the tab order; arrows move within.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              // h-9 inside a 3px-padded 44px-tall track keeps the whole control
              // on the 44px tap minimum without each segment looking oversized.
              HIT_AREA,
              'inline-flex min-w-0 items-center justify-center gap-1.5 px-4 text-[0.84375rem] font-semibold transition-colors outline-none',
              size === 'field' ? 'h-full rounded-[11px]' : 'h-9 rounded-[9px]',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]',
              fill && 'flex-1',
              selected
                ? 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]',
            )}
          >
            {o.icon ? (
              <span aria-hidden className="flex shrink-0 items-center [&_svg]:size-4">
                {o.icon}
              </span>
            ) : null}
            <span className="truncate">{o.label}</span>
            {o.count !== undefined ? (
              <span
                className={cn(
                  'font-mono-numbers text-[0.6875rem] font-semibold tabular-nums',
                  selected
                    ? 'text-[var(--color-brand-text-muted)]'
                    : 'text-[var(--color-brand-text-muted)]',
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
