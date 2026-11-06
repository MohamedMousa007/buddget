'use client'

import { useMemo, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { goalVisual } from '@/lib/goals/goalVisual'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { Badge } from '@/components/ui/badge'

function Row({
  goal, index, last, keep, onMove,
}: { goal: Goal; index: number; last: boolean; keep: number | null; onMove: (dir: -1 | 1) => void }) {
  // `keep` arrives in the goal's own currency
  const t = useT().goals.split
  const controls = useDragControls()
  const { icon: Icon, cat } = goalVisual(goal.category)
  const pct = goal.sharePct ?? 0
  return (
    <Reorder.Item
      value={goal.id}
      dragListener={false}
      dragControls={controls}
      className="flex flex-col gap-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3"
    >
      <div className="flex items-center gap-2">
        <IconButton size="sm" aria-label={t.dragHandle} onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none">
          <GripVertical />
        </IconButton>
        <span
          className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] font-mono-numbers text-[0.6875rem] font-bold text-[var(--color-brand-on-primary)]"
          aria-label={t.priority(index + 1)}
        >
          {index + 1}
        </span>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ color: `var(--color-cat-${cat})`, background: `color-mix(in srgb, var(--color-cat-${cat}) 16%, var(--color-brand-card))` }}
          aria-hidden
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{goal.name}</p>
          {keep !== null ? (
            <p className="truncate font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
              {t.perMonth(formatCurrency(Math.round((keep * pct) / 100), goal.currency, false))}
            </p>
          ) : null}
        </div>
        <span className="font-mono-numbers text-base font-semibold text-[var(--color-brand-text-primary)]">{pct}%</span>
        <div className="flex flex-col">
          <IconButton size="sm" aria-label={t.moveUp} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp />
          </IconButton>
          <IconButton size="sm" aria-label={t.moveDown} disabled={last} onClick={() => onMove(1)}>
            <ArrowDown />
          </IconButton>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-brand-elevated)]">
        <div className="h-full rounded-full bg-[var(--color-brand-primary-bright)]" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </Reorder.Item>
  )
}

/** Priority order for shared savings. Totals above 100% are fine: earlier goals fill first. */
export function SplitSavingsSheet({ onClose }: { onClose: () => void }) {
  const t = useT().goals.split
  const s = useFinanceStore(
    useShallow((st) => ({
      goals: st.goals, incomeEvents: st.incomeEvents, incomeSources: st.incomeSources, expenses: st.expenses,
      budgetCategories: st.budgetCategories, budgetPlans: st.budgetPlans, activeBudgetPlanId: st.activeBudgetPlanId, exchangeRates: st.exchangeRates, settings: st.settings,
    })),
  )
  const shared = useMemo(
    () => s.goals.filter((g) => g.status === 'active' && g.fundingMode === 'share').sort((a, b) => a.priority - b.priority),
    [s.goals],
  )
  const [order, setOrder] = useState(() => shared.map((g) => g.id))
  const byId = new Map(shared.map((g) => [g.id, g]))
  const ordered = order.map((id) => byId.get(id)).filter((g): g is Goal => Boolean(g))
  const total = ordered.reduce((sum, g) => sum + (g.sharePct ?? 0), 0)
  const base = useMemo(() => fundingBasis(s, new Date()), [s])
  const ccy = s.settings.baseCurrency
  const keep = base.usualKeep

  const move = (i: number, dir: -1 | 1) =>
    setOrder((o) => {
      const next = [...o]
      ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
      return next
    })

  const save = () => {
    // Slots already held by these goals are reassigned in the new order, so other goals keep theirs.
    const slots = shared.map((g) => g.priority).sort((a, b) => a - b)
    const update = useFinanceStore.getState().updateGoal
    order.forEach((id, i) => update(id, { priority: slots[i] }))
    onClose()
  }

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={t.title}
      zClassName="z-[120]"
      footer={<Button size="cta-block" onClick={save}>{t.save}</Button>}
    >
      <p className="text-sm text-[var(--color-brand-text-secondary)]">{t.sub}</p>
      {keep !== null ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-brand-elevated)] px-3.5 py-3">
          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {t.keep(formatCurrency(Math.round(keep), ccy, false))}
          </p>
          <Badge tone="card" size="sm" bordered={false} className="text-[var(--color-brand-text-secondary)]">{t.last3}</Badge>
        </div>
      ) : null}
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-2.5">
        {ordered.map((g, i) => (
          <Row
            key={g.id}
            goal={g}
            index={i}
            last={i === ordered.length - 1}
            keep={base.usualKeep === null ? null : convertCurrency(base.usualKeep, s.settings.baseCurrency, g.currency, s.exchangeRates)}
            onMove={(d) => move(i, d)}
          />
        ))}
      </Reorder.Group>
      <p className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.total(total)}</p>
      <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3.5">
        <BuddgyIcon size={24} />
        <p className="text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-primary)]">{total > 100 ? t.noteOver : t.noteFit}</p>
      </div>
    </SheetFrame>
  )
}
