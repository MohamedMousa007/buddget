'use client'

import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Card } from '@/components/ui/card'
import { OptionChip } from '@/components/ui/OptionChip'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import type { PlanView } from '@/lib/budget/planView.types'
import { stressPlan, type StressKind, type StressLine } from '@/lib/budget/stressTest'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatCurrency } from '@/lib/utils/formatters'
import { useBudgetStressCopy } from '../useStressCopy'

const KINDS: StressKind[] = ['income', 'bills', 'everyday']
const PCTS = [10, 20, 30]

export interface StressTestSheetProps {
  open: boolean
  view: PlanView
  onClose: () => void
}

/** Applies a made-up bad month to the plan and shows the gap and what would be trimmed. Changes nothing. */
export function StressTestSheet({ open, view, onClose }: StressTestSheetProps) {
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      {open ? <StressBody view={view} onClose={onClose} /> : null}
    </ModalShell>
  )
}

function StressBody({ view, onClose }: { view: PlanView; onClose: () => void }) {
  const c = useBudgetStressCopy()
  const [kind, setKind] = useState<StressKind>('income')
  const [pct, setPct] = useState(20)
  const money = (n: number) => formatCurrency(n, view.base, false)

  const lines = useMemo<StressLine[]>(
    () =>
      BUDGET_BLOCKS.flatMap((b) =>
        view.blocks[b].lines.map((l) => ({
          id: l.line.id,
          name: l.line.name,
          block: b,
          amount: l.amount,
          essential: !!l.line.essential,
          locked: !!l.line.locked,
          linked: (l.line.linkType ?? 'none') !== 'none',
        })),
      ),
    [view],
  )
  const r = useMemo(() => stressPlan(lines, view.income, { kind, pct }), [lines, view.income, kind, pct])
  const deficit = r.free < 0

  return (
    <div className="flex flex-col gap-4 pt-1">
      <V3SheetHeader title={c.title} onClose={onClose} />
      <p className="text-sm text-[var(--color-brand-text-secondary)]">{c.intro}</p>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <OptionChip key={k} as="trigger" size="md" selected={kind === k} onClick={() => setKind(k)}>
            {c.kinds[k]}
          </OptionChip>
        ))}
      </div>
      <div className="flex gap-2">
        {PCTS.map((p) => (
          <OptionChip key={p} as="trigger" size="segment" selected={pct === p} onClick={() => setPct(p)}>
            {c.pct(p)}
          </OptionChip>
        ))}
      </div>

      <Card padding="md" className="flex flex-col gap-2">
        <Row label={c.income} value={money(r.income)} />
        <Row label={c.planned} value={money(r.total)} />
        <div className="flex items-baseline justify-between border-t border-[var(--color-brand-border)] pt-2">
          <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.after}</span>
          <span
            className="font-mono-numbers text-lg font-semibold"
            style={{ color: deficit ? 'var(--color-brand-red-text)' : 'var(--color-brand-green)' }}
          >
            {deficit ? c.deficit(money(-r.free)) : money(r.free)}
          </span>
        </div>
      </Card>

      {!deficit ? (
        <p className="text-sm text-[var(--color-brand-green)]">{c.fine}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {r.trims.length > 0 ? (
            <>
              <p className={microClassName}>{c.trimsTitle}</p>
              {r.trims.map((t) => (
                <p key={t.id} className="font-mono-numbers text-sm text-[var(--color-brand-text-primary)]">
                  {c.trimLine(t.name, money(t.from), money(t.to))}
                </p>
              ))}
            </>
          ) : null}
          <p className={`text-sm ${r.shortfall > 0 ? 'text-[var(--color-brand-red-text)]' : 'text-[var(--color-brand-green)]'}`}>
            {r.shortfall > 0 ? c.short(money(r.shortfall)) : c.holds}
          </p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{c.note}</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-[var(--color-brand-text-secondary)]">{label}</span>
      <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{value}</span>
    </div>
  )
}
