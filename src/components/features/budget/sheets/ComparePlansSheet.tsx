'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Card } from '@/components/ui/card'
import { OptionChip } from '@/components/ui/OptionChip'
import { comparePlans } from '@/lib/budget/comparePlans'
import { formatCurrency } from '@/lib/utils/formatters'
import type { BudgetPlan, Currency } from '@/lib/store/types'
import { blockColor } from '../chromeFormat'
import { useBudgetDeckCopy } from '../useDeckCopy'
import { useBudgetSheetsCopy } from '../useSheetsCopy'

export interface ComparePlansSheetProps {
  open: boolean
  plans: BudgetPlan[]
  aId: string | null
  bId: string | null
  base: Currency
  rates: Record<string, number>
  onChange: (aId: string, bId: string) => void
  onClose: () => void
}

/** Two budgets side by side: totals, each block, and the lines that differ. */
export function ComparePlansSheet({ open, plans, aId, bId, base, rates, onChange, onClose }: ComparePlansSheetProps) {
  const c = useBudgetDeckCopy().compare
  const blockNames = useBudgetSheetsCopy().blocks
  const a = plans.find((p) => p.id === aId) ?? null
  const b = plans.find((p) => p.id === bId) ?? null
  const cmp = a && b ? comparePlans(a, b, base, rates) : null
  const money = (n: number) => formatCurrency(n, base, false)
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`

  const picker = (label: string, value: string | null, other: string | null, set: (id: string) => void) => (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{label}</span>
      <div className="native-scroll hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {plans.map((p) => (
          <OptionChip key={p.id} selected={p.id === value} disabled={p.id === other} onClick={() => set(p.id)}>
            {p.name}
          </OptionChip>
        ))}
      </div>
    </div>
  )

  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      <div className="flex flex-col gap-4 pb-4">
        <V3SheetHeader title={c.title} onClose={onClose} />
        {picker(c.a, aId, bId, (id) => bId && onChange(id, bId))}
        {picker(c.b, bId, aId, (id) => aId && onChange(aId, id))}
        {cmp && a && b ? (
          <>
            <Card variant="elevated" padding="md" className="grid grid-cols-2 gap-3">
              <div>
                <p className="truncate text-xs text-[var(--color-brand-text-secondary)]">{a.name}</p>
                <p className="font-mono-numbers text-lg font-semibold text-[var(--color-brand-text-primary)]">{money(cmp.totalA)}</p>
              </div>
              <div className="text-end">
                <p className="truncate text-xs text-[var(--color-brand-text-secondary)]">{b.name}</p>
                <p className="font-mono-numbers text-lg font-semibold text-[var(--color-brand-text-primary)]">{money(cmp.totalB)}</p>
              </div>
            </Card>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{c.blocks}</p>
            <Card padding="none" divide>
              {cmp.blocks.map((row) => (
                <div key={row.block} className="flex min-h-12 items-center gap-3 px-4 py-2">
                  <span className="size-2.5 shrink-0 rounded-[4px]" style={{ background: blockColor(row.block) }} aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-[var(--color-brand-text-primary)]">{blockNames[row.block]}</span>
                    <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
                      {money(row.a)} → {money(row.b)}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-end font-mono-numbers text-xs font-semibold ${row.delta === 0 ? 'text-[var(--color-brand-text-muted)]' : 'text-[var(--color-brand-text-primary)]'}`}
                  >
                    {row.delta === 0 ? '·' : signed(row.delta)}
                  </span>
                </div>
              ))}
            </Card>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{c.differs}</p>
            {cmp.lines.length === 0 ? (
              <p className="text-sm text-[var(--color-brand-text-secondary)]">{c.match}</p>
            ) : (
              <Card padding="none" divide>
                {cmp.lines.map((l) => (
                  <div key={`${l.block}-${l.name}`} className="flex min-h-12 items-center gap-3 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-brand-text-primary)]">{l.name}</p>
                      <p className="truncate text-xs text-[var(--color-brand-text-muted)]">
                        {l.a == null ? c.onlyIn(b.name) : l.b == null ? c.onlyIn(a.name) : `${money(l.a)} → ${money(l.b)}`}
                      </p>
                    </div>
                    <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{signed(l.delta)}</span>
                  </div>
                ))}
              </Card>
            )}
          </>
        ) : null}
      </div>
    </ModalShell>
  )
}
