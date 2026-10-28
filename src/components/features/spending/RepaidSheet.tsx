'use client'

import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AccountPicker } from '@/components/features/accounts/AccountPicker'
import { Button } from '@/components/ui/button'
import { AmountField } from '@/components/ui/AmountField'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { recordRepayment, repaymentCandidates } from '@/lib/spending/receivable'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

interface RepaidSheetProps {
  open: boolean
  onClose: () => void
  expense: Expense
  onDone: () => void
}

/** Someone paid back what was spent for them: credit an account without counting it as income. */
export function RepaidSheet({ open, onClose, expense, onDone }: RepaidSheetProps) {
  const t = useT().exclusion
  const { accounts } = useAccounts()
  const incomes = useFinanceStore((s) => s.incomeEvents)
  const [accountId, setAccountId] = useState(() => accounts[0]?.method.id ?? '')
  const [amount, setAmount] = useState(String(expense.amount))
  const [fromIncomeId, setFromIncomeId] = useState<string | undefined>()
  const account = accounts.find((a) => a.method.id === accountId) ?? accounts[0]
  const candidates = useMemo(
    () => (account ? repaymentCandidates(expense, incomes, String(account.method.currency)) : []),
    [expense, incomes, account],
  )
  const value = parseFloat(amount)
  const valid = Boolean(account) && (fromIncomeId !== undefined || value > 0)

  const submit = () => {
    if (!account || !valid) return
    recordRepayment({ expenseId: expense.id, accountId: account.method.id, amount: value, fromIncomeId })
    onDone()
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{t.repaidTitle}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{expense.owedBy ? `${expense.owedBy} · ${expense.description}` : expense.description}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-3 pt-3">
          {accounts.length > 0 ? <AccountPicker accounts={accounts} value={account?.method.id ?? ''} onChange={(id) => { setAccountId(id); setFromIncomeId(undefined) }} /> : null}
          {candidates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[var(--color-brand-text-secondary)]">{t.linkPayment}</p>
              {candidates.map((i) => (
                <Button key={i.id} variant={fromIncomeId === i.id ? 'secondary' : 'outline'} size="cta-block" className="justify-between" onClick={() => setFromIncomeId(fromIncomeId === i.id ? undefined : i.id)}>
                  <span className="truncate">{i.name} · {i.receivedDate.slice(0, 10)}</span>
                  <span className="font-mono-numbers">{i.amount}</span>
                </Button>
              ))}
            </div>
          ) : null}
          {fromIncomeId === undefined ? (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[var(--color-brand-text-secondary)]">{t.noLink}</p>
              <AmountField value={amount} onChange={setAmount} currency={String(account?.method.currency ?? expense.currency)} placeholder="0" />
            </div>
          ) : null}
        </div>
        <div className="sheet-cta shrink-0 border-t border-[var(--color-brand-border)] px-5 pt-3 pb-6">
          <Button size="cta-block" disabled={!valid} onClick={submit}>{t.markRepaid}</Button>
        </div>
      </div>
    </ModalShell>
  )
}
