'use client'

import { useState } from 'react'
import { Copy, GitCompare, Hammer, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type CardMenuItem } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { formatCurrency } from '@/lib/utils/formatters'
import type { PlanSummary } from '@/lib/budget/planSummary'
import type { BudgetPlan, Currency } from '@/lib/store/types'
import { blockColor, percentText } from './chromeFormat'
import { useBudgetDeckCopy } from './useDeckCopy'

export interface PlanDeckProps {
  plans: BudgetPlan[]
  activeId: string | null
  selectedId: string
  summaries: Record<string, PlanSummary>
  income: number
  base: Currency
  /** Month label the active plan has been active since, e.g. "Oct". */
  activeSince: string | null
  /** Budget being renamed (controlled so the page's overflow menu can start it). */
  renamingId: string | null
  onRenaming: (id: string | null) => void
  onSelect: (id: string) => void
  onActivate: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onCompare: (id: string) => void
  onNew: () => void
  /** Resume the builder for a draft plan. */
  onContinue: (id: string) => void
  /** Adds "Ask Buddgy" to the action row (before Delete) so the row is never short of an item. */
  onAdjust?: () => void
  adjustLabel?: string
}

/** The selected budget's actions in one row; Delete stays last, the Buddgy action sits just before it. */
function actionRow(items: CardMenuItem[], onAdjust?: () => void, label?: string): Array<CardMenuItem & { brand?: boolean }> {
  if (!onAdjust || !label) return items
  const last = items[items.length - 1]
  return [...items.slice(0, -1), { label, icon: <Sparkles className="size-5" />, onSelect: onAdjust, brand: true }, last]
}

type PlanActions = Pick<PlanDeckProps, 'plans' | 'onDuplicate' | 'onDelete' | 'onCompare'>

/** The per-budget actions, shared by the switcher sheet and the page's overflow menu. */
export function planActionItems(id: string, p: PlanActions, copy: ReturnType<typeof useBudgetDeckCopy>, onRename: () => void): CardMenuItem[] {
  const c = copy.deck
  return [
    { label: c.duplicate, icon: <Copy className="size-5" />, onSelect: () => p.onDuplicate(id) },
    { label: c.rename, icon: <Pencil className="size-5" />, onSelect: onRename },
    ...(p.plans.length > 1 ? [{ label: copy.compare.action, icon: <GitCompare className="size-5" />, onSelect: () => p.onCompare(id) }] : []),
    { label: c.delete, icon: <Trash2 className="size-5" />, destructive: true, onSelect: () => p.onDelete(id) },
  ]
}

/** Swipeable cards of every budget with the actions for the selected one. */
export function PlanDeck(p: PlanDeckProps) {
  const copy = useBudgetDeckCopy()
  const c = copy.deck
  const renaming = p.renamingId
  const setRenaming = p.onRenaming
  const selected = p.plans.find((x) => x.id === p.selectedId) ?? p.plans[0]
  const isActive = selected?.id === p.activeId

  const stateLabel = (plan: BudgetPlan) =>
    plan.id === p.activeId ? c.active : plan.status === 'draft' ? c.draft : plan.status === 'archived' ? c.archived : c.ready

  const commitRename = (name: string) => {
    if (renaming && name.trim()) p.onRename(renaming, name.trim())
    setRenaming(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={c.title} className="native-scroll hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {p.plans.map((plan) => {
          const sum = p.summaries[plan.id]
          const active = plan.id === p.activeId
          return (
            <SelectableCard
              key={plan.id}
              as="radio"
              layout="stack"
              surface="card"
              selected={plan.id === selected?.id}
              aria-label={c.cardLabel(plan.name, stateLabel(plan))}
              onClick={() => p.onSelect(plan.id)}
              className="min-h-[188px] w-[250px] shrink-0 snap-center gap-3 p-3.5"
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold text-[var(--color-brand-text-primary)]">{plan.name}</span>
                  <Badge variant="muted" className="mt-1">{c.intent[plan.intent ?? 'custom']}</Badge>
                </span>
                <Badge variant={active ? 'positive' : 'muted'}>{stateLabel(plan)}</Badge>
              </span>
              <span className="flex h-3.5 w-full gap-0.5">
                {sum?.flow.map((f) => (
                  <span key={f.block} className="block h-full rounded" style={{ width: `${f.percent}%`, background: blockColor(f.block) }} />
                ))}
              </span>
              <span className="grid w-full grid-cols-2 gap-2">
                <span>
                  <span className="block text-xs text-[var(--color-brand-text-muted)]">{c.income}</span>
                  <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{formatCurrency(p.income, p.base, false)}</span>
                </span>
                <span>
                  <span className="block text-xs text-[var(--color-brand-text-muted)]">{c.savingsRate}</span>
                  <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{percentText(sum?.savingsRate ?? 0)}</span>
                </span>
              </span>
              <span className="text-xs text-[var(--color-brand-text-secondary)]">
                {active && p.activeSince ? c.activeSince(p.activeSince) : c.lines(sum?.lineCount ?? 0)}
              </span>
            </SelectableCard>
          )
        })}
        <SelectableCard
          as="action"
          layout="stack"
          surface="card"
          onClick={p.onNew}
          className="min-h-[188px] w-[250px] shrink-0 snap-center items-center justify-center gap-2 border-dashed text-center"
        >
          <Plus className="size-6 text-[var(--color-brand-primary-ink)]" aria-hidden />
          <span className="text-[17px] font-semibold text-[var(--color-brand-text-primary)]">{c.newPlan}</span>
          <span className="text-xs text-[var(--color-brand-text-secondary)]">{c.newPlanSub}</span>
        </SelectableCard>
      </div>

      {selected ? (
        <>
          {renaming === selected.id ? (
            <Input
              size="brand"
              autoFocus
              defaultValue={selected.name}
              placeholder={c.renamePlaceholder}
              onBlur={(e) => commitRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(e.currentTarget.value)
                if (e.key === 'Escape') setRenaming(null)
              }}
            />
          ) : null}
          {selected.status === 'draft' ? (
            <Button size="cta" className="w-full" onClick={() => p.onContinue(selected.id)}>
              <Hammer />
              {c.continueBuilding}
            </Button>
          ) : (
            <Button size="cta" className="w-full" disabled={isActive} onClick={() => p.onActivate(selected.id)}>
              <Star />
              {isActive ? c.active : c.setActive}
            </Button>
          )}
          <div className="flex gap-1">
            {actionRow(planActionItems(selected.id, p, copy, () => setRenaming(selected.id)), p.onAdjust, p.adjustLabel).map((it) => (
              <div key={it.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <IconButton variant={it.destructive ? 'danger' : it.brand ? 'brand' : 'outlined'} size="lg" aria-label={it.label} onClick={it.onSelect}>
                  {it.icon}
                </IconButton>
                <span className="w-full truncate text-center text-xs font-medium text-[var(--color-brand-text-secondary)]">{it.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
