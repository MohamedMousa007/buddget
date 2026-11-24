'use client'

import { useState } from 'react'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { AccountLegRow } from '@/components/features/savings-v3/MoneySheetParts'
import { useLegAccount } from '@/components/features/savings-v3/useLegAccount'
import { useDepositGuard } from '@/components/features/savings-v3/useDepositGuard'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { useT } from '@/lib/i18n'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'
import { useGoalProgress } from '@/hooks/useGoalProgress'
import { goalAddHint } from '@/lib/goals/goalAddHint'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { formatCurrency } from '@/lib/utils/formatters'

/** Manual deposit into the goal's pocket; creates the pocket (and links it) when the goal has none. */
export function GoalAddMoneySheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const t = useT().goals.home
  const tMoney = useT().wealthSheets.money
  const cat = useT().catalogs
  const pocket = useFinanceStore((s) => s.savingsAccounts.find((a) => !!goal && goal.linkedSavingsAccountIds.includes(a.id) && isEligibleCarryPocket(a)))
  const leg = useLegAccount(pocket, String(goal?.currency ?? ''))
  const [amount, setAmount] = useState('')
  const value = Number(amount)
  // A pocket set aside in an account is funded from that account's own money; a goal with no pocket yet gets one outside the accounts.
  const guard = useDepositGuard(pocket ?? (goal ? { currency: goal.currency, currentBalance: 0 } : undefined))
  const fromAccountId = guard.holder ? null : leg.accountId
  const refusal = guard.refusalFor({ amount: value > 0 ? value : 0, currency: String(goal?.currency ?? ''), fromAccountId })
  // No account can fund it: the only honest entry is new money, which the user confirms on the button.
  const asNewMoney = refusal === 'no_account_leg'
  const blocked = !!refusal && !asNewMoney

  const save = () => {
    if (!goal || !(value > 0) || blocked) return
    const s = useFinanceStore.getState()
    let pocketId = s.savingsAccounts.find((a) => goal.linkedSavingsAccountIds.includes(a.id) && isEligibleCarryPocket(a))?.id
    if (!pocketId) {
      pocketId = s.addSavingsAccount({ name: cat.goalPocketName(goal.name), category: 'savings', type: 'vault', currency: goal.currency })
      s.updateGoal(goal.id, { linkedSavingsAccountIds: [...goal.linkedSavingsAccountIds, pocketId] })
    }
    s.depositToSavings(pocketId, value, goal.currency, goal.name, asNewMoney ? { mode: 'declare' } : { fromAccountId })
    setAmount('')
    onClose()
  }

  return (
    <SheetFrame
      open={goal !== null}
      onClose={onClose}
      title={goal ? t.addMoneyTitle(goal.name) : ''}
      footer={
        <Button size="cta-block" disabled={!(value > 0) || blocked} onClick={save}>
          {asNewMoney ? tMoney.addAsNewMoney : t.addMoneyCta}
        </Button>
      }
    >
      <AmountField value={amount} onChange={setAmount} currency={goal?.currency} aria-label={t.addMoneyAmount} />
      {goal && goal.category !== 'debt_freedom' && goal.category !== 'spending_control' ? <AddHintLine goal={goal} add={value} /> : null}
      {guard.holder ? (
        <p className="mt-4 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{tMoney.setAsideIn(accountTitle(guard.holder))}</p>
      ) : (
        <div className="mt-4"><AccountLegRow leg={leg} label={tMoney.fromAccount} /></div>
      )}
      {refusal ? <p role="alert" className="mt-2 text-[0.8125rem] text-[var(--color-brand-amber)]">{guard.message(refusal, fromAccountId)}</p> : null}
    </SheetFrame>
  )
}

/** "X left" / "+X over target" under the amount: information only, the deposit is never capped (BUD-99). */
function AddHintLine({ goal, add }: { goal: Goal; add: number }) {
  const t = useT().goals.home
  const hidden = useMask('lists')
  const { currentAmount } = useGoalProgress(goal)
  const hint = goalAddHint(currentAmount, goal.targetAmount, add)
  if (!hint) return null
  const money = (n: number) => (hidden ? MASK : formatCurrency(n, goal.currency, false))
  const text = hint.kind === 'exact' ? t.addExact : hint.kind === 'left' ? t.addLeft(money(hint.amount)) : t.addOver(money(hint.amount))
  return (
    <p dir="auto" role="status" className="mt-2 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
      {text}
    </p>
  )
}
