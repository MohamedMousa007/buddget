'use client'

import { Plus } from 'lucide-react'
import type { DebtFamily } from '@/lib/debts/debtFamily'
import { fmtWhole } from './heroCardShared'

export interface DebtPortfolioHeroProps {
  owed: number
  base: string
  secondaryText?: string | null
  clearedPct: number
  counts: Record<DebtFamily, number>
  onAddDebt: () => void
}

function ClearedRing({ pct }: { pct: number }) {
  const r = 25
  const c = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c
  return (
    <div className="relative h-[62px] w-[62px] shrink-0">
      <svg viewBox="0 0 62 62" className="h-full w-full -rotate-90">
        <circle cx="31" cy="31" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
        <circle
          cx="31"
          cy="31"
          r={r}
          fill="none"
          stroke="#1DB954"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono-numbers text-[14px] font-bold text-white">
        {pct}%
      </span>
    </div>
  )
}

/** Fixed portfolio hero (dark gradient, not tab-scoped) — handoff §2. */
export function DebtPortfolioHero({
  owed,
  base,
  secondaryText,
  clearedPct,
  counts,
  onAddDebt,
}: DebtPortfolioHeroProps) {
  const cells: { label: string; n: number }[] = [
    { label: 'Borrow', n: counts.borrow },
    { label: 'Cards', n: counts.credit_card },
    { label: 'Installments', n: counts.installment },
  ]
  return (
    <div className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[18px] dark:border-white/5 dark:bg-[linear-gradient(150deg,#1d1416,#121017)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">Total still owed</p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono-numbers text-[34px] font-bold leading-none tracking-[-1px] text-[var(--color-brand-text-primary)]">
              {fmtWhole(owed)}
            </span>
            <span className="text-sm font-medium text-[var(--color-brand-text-muted)]">{base}</span>
          </p>
          {secondaryText ? (
            <p className="mt-1.5 font-mono-numbers text-[13px] text-[var(--color-brand-text-muted)]">≈ {secondaryText}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <ClearedRing pct={clearedPct} />
          <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">Cleared</span>
        </div>
      </div>

      {/* Family-count strip */}
      <div className="mt-3.5 grid grid-cols-3 overflow-hidden rounded-[12px] border border-[var(--color-brand-border)] dark:border-white/8">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`flex flex-col items-center py-2 ${i > 0 ? 'border-s border-[var(--color-brand-border)] dark:border-white/8' : ''}`}
          >
            <span className="font-mono-numbers text-base font-bold text-[var(--color-brand-text-primary)]">{cell.n}</span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--color-brand-text-muted)]">{cell.label}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddDebt}
        className="mt-3.5 flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-[var(--color-brand-red)] text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(229,9,20,0.55)] transition-colors hover:bg-[var(--color-brand-red-hover)] active:translate-y-px"
      >
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
        Add debt
      </button>
    </div>
  )
}
