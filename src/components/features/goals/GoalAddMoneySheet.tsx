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
      {guard.holder ? (
        <p className="mt-4 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{tMoney.setAsideIn(accountTitle(guard.holder))}</p>
      ) : (
        <div className="mt-4"><AccountLegRow leg={leg} label={tMoney.fromAccount} /></div>
      )}
      {refusal ? <p role="alert" className="mt-2 text-[0.8125rem] text-[var(--color-brand-amber)]">{guard.message(refusal)}</p> : null}
    </SheetFrame>
  )
}
