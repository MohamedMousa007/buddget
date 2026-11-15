import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PlanCompareRow { label: string; free: string; pro: string }

/** Free against Pro, one row per difference. The Pro column carries the brand tint; text runs resolve their own direction. */
export function PlanCompare({ head, rows, className }: { head: { label: string; free: string; pro: string }; rows: PlanCompareRow[]; className?: string }) {
  const grid = 'grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1fr)] items-stretch'
  const cell = 'flex items-center px-2.5 py-2 text-[0.78125rem] leading-snug'
  return (
    <div role="table" className={cn('overflow-hidden rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]', className)}>
      <div role="row" className={cn(grid, 'min-h-11 text-xs font-bold')}>
        <div role="columnheader" dir="auto" className={cn(cell, 'ps-3.5 text-[var(--color-brand-text-muted)]')}>{head.label}</div>
        <div role="columnheader" dir="auto" className={cn(cell, 'text-[var(--color-brand-text-secondary)]')}>{head.free}</div>
        <div role="columnheader" dir="auto" className={cn(cell, 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]')}>{head.pro}</div>
      </div>
      {rows.map((r) => (
        <div key={r.label} role="row" className={cn(grid, 'min-h-[52px] border-t border-[var(--color-brand-border)]')}>
          <div role="cell" dir="auto" className={cn(cell, 'ps-3.5 font-semibold text-[var(--color-brand-text-primary)]')}>{r.label}</div>
          <div role="cell" dir="auto" className={cn(cell, 'text-[var(--color-brand-text-secondary)]')}>{r.free}</div>
          <div role="cell" dir="auto" className={cn(cell, 'gap-1.5 bg-[var(--color-brand-primary-soft)] font-bold text-[var(--color-brand-primary-ink)]')}>
            <Check className="size-3.5 shrink-0" aria-hidden />
            {r.pro}
          </div>
        </div>
      ))}
    </div>
  )
}
