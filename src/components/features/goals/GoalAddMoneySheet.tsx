'use client'

import { useState } from 'react'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'

/** Manual deposit into the goal's pocket; creates the pocket (and links it) when the goal has none. */
export function GoalAddMoneySheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const t = useT().goals.home
  const [amount, setAmount] = useState('')
  const value = Number(amount)

  const save = () => {
    if (!goal || !(value > 0)) return
    const s = useFinanceStore.getState()
    let pocketId = s.savingsAccounts.find((a) => goal.linkedSavingsAccountIds.includes(a.id) && isEligibleCarryPocket(a))?.id
    if (!pocketId) {
      pocketId = s.addSavingsAccount({ name: `${goal.name} pocket`, category: 'savings', type: 'vault', currency: goal.currency })
      s.updateGoal(goal.id, { linkedSavingsAccountIds: [...goal.linkedSavingsAccountIds, pocketId] })
    }
    s.depositToSavings(pocketId, value, goal.currency, goal.name)
    setAmount('')
    onClose()
  }

  return (
    <SheetFrame
      open={goal !== null}
      onClose={onClose}
      title={goal ? t.addMoneyTitle(goal.name) : ''}
      footer={
        <Button size="cta-block" disabled={!(value > 0)} onClick={save}>
          {t.addMoneyCta}
        </Button>
      }
    >
      <AmountField value={amount} onChange={setAmount} currency={goal?.currency} aria-label={t.addMoneyAmount} />
    </SheetFrame>
  )
}
