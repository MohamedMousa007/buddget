'use client'

import { useState } from 'react'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useT } from '@/lib/i18n'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'

/** Asks where the pocket money goes: leave the pocket in Wealth, or move it to another pocket. */
export function DeleteGoalSheet({ goal, onClose, onDeleted }: { goal: Goal; onClose: () => void; onDeleted: () => void }) {
  const t = useT().goals.detail
  const accounts = useFinanceStore((s) => s.savingsAccounts)
  const [choice, setChoice] = useState<'keep' | 'move'>('keep')
  const [dest, setDest] = useState<string | null>(null)

  const owned = accounts.filter((a) => goal.linkedSavingsAccountIds.includes(a.id))
  const others = accounts.filter((a) => isEligibleCarryPocket(a) && !goal.linkedSavingsAccountIds.includes(a.id))

  const confirm = () => {
    const s = useFinanceStore.getState()
    if (choice === 'move' && dest) {
      for (const p of owned) if (p.currentBalance > 0) s.transferBetweenPockets(p.id, dest, p.currentBalance, goal.name)
    }
    s.deleteGoal(goal.id)
    onDeleted()
  }

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={t.deleteTitle(goal.name)}
      zClassName="z-[110]"
      footer={
        <Button size="cta-block" variant="destructive-solid" disabled={choice === 'move' && !dest} onClick={confirm}>
          {t.deleteConfirm}
        </Button>
      }
    >
      {owned.length > 0 ? (
        <>
          <p className="text-sm text-[var(--color-brand-text-secondary)]">{t.deleteBody}</p>
          <div role="radiogroup" aria-label={t.deleteBody} className="flex flex-col gap-2">
            <SelectableCard selected={choice === 'keep'} onClick={() => setChoice('keep')} className="min-h-14 flex-col items-start gap-0.5">
              <span className="text-sm font-semibold">{t.deleteKeep}</span>
              <span className="text-xs text-[var(--color-brand-text-secondary)]">{t.deleteKeepSub}</span>
            </SelectableCard>
            <SelectableCard selected={choice === 'move'} onClick={() => setChoice('move')} className="min-h-14 flex-col items-start gap-0.5">
              <span className="text-sm font-semibold">{t.deleteMove}</span>
              <span className="text-xs text-[var(--color-brand-text-secondary)]">{others.length ? t.deleteMoveSub : t.noOtherPocket}</span>
            </SelectableCard>
          </div>
          {choice === 'move' && others.length > 0 ? (
            <div role="radiogroup" aria-label={t.deleteMove} className="flex flex-col gap-2">
              {others.map((a) => (
                <SelectableCard key={a.id} selected={dest === a.id} onClick={() => setDest(a.id)} className="min-h-12 justify-between">
                  <span className="truncate text-sm font-semibold">{a.name}</span>
                  <span className="font-mono-numbers text-xs">{formatCurrency(a.currentBalance, a.currency, false)}</span>
                </SelectableCard>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </SheetFrame>
  )
}
