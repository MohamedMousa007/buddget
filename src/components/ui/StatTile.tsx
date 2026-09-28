'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface StatTileProps {
  /** Small caps label above the value. */
  label: string
  /** Pre-formatted figure. Callers format; this component never does maths. */
  value: ReactNode
  /** Currency or unit shown after the value, de-emphasised. */
  unit?: string
  /** Secondary line under the value — a conversion, a denominator, a date. */
  sub?: ReactNode
  /** Leading icon chip. */
  icon?: ReactNode
  /** Trailing element, usually a delta <Badge>. */
  trailing?: ReactNode
  /** Tints the value. `default` is plain text — outflows are NOT red. */
  tone?: 'default' | 'positive' | 'negative' | 'brand'
  /** Compact removes the icon row and shrinks the value — for a 3-up KPI row. */
  compact?: boolean
  onClick?: () => void
  className?: string
}

const TONE: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'text-[var(--color-brand-text-primary)]',
  positive: 'text-[var(--color-brand-green)]',
  negative: 'text-[var(--color-brand-red)]',
  brand: 'text-[var(--color-brand-primary-ink)]',
}

/**
 * A single figure on a card — the dashboard KPI tile and the in/out/net row.
 *
 * Deliberately **presentational and store-free**, unlike `dashboard/KPICard`
 * which reads Zustand directly and therefore cannot be reused, previewed or
 * designed against. Callers pass formatted strings.
 *
 * Amounts use `font-mono-numbers` + `tabular-nums` so columns of tiles align.
 */
export function StatTile({
  label,
  value,
  unit,
  sub,
  icon,
  trailing,
  tone = 'default',
  compact = false,
  onClick,
  className,
}: StatTileProps) {
  return (
    <Card
      padding={compact ? 'sm' : 'md'}
      radius={compact ? 'sm' : 'default'}
      interactive={!!onClick}
      render={onClick ? <button type="button" onClick={onClick} /> : undefined}
      className={cn('min-w-0', className)}
    >
      {!compact && (icon || trailing) ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          {icon ? (
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
              {icon}
            </span>
          ) : <span />}
          {trailing}
        </div>
      ) : null}

      <p
        className={cn(
          'truncate font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]',
          compact ? 'text-[10.5px]' : 'text-[11px]',
        )}
      >
        {label}
      </p>

      <p className={cn('mt-1 flex items-baseline gap-1.5', TONE[tone])}>
        <span
          className={cn(
            'font-mono-numbers font-bold leading-none tracking-[-0.01em] tabular-nums',
            compact ? 'text-[15px]' : 'text-[22px]',
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-xs font-medium text-[var(--color-brand-text-muted)]">{unit}</span>
        ) : null}
      </p>

      {sub ? (
        <p className="mt-1 truncate text-[11px] text-[var(--color-brand-text-muted)]">{sub}</p>
      ) : null}
    </Card>
  )
}
