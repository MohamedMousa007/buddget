'use client'

import { useState } from 'react'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { OptionChip } from '@/components/ui/OptionChip'
import { useActionToast } from '@/components/ui/ActionToast'
import { paysFrom } from '@/lib/accounts/cardHold'
import { defaultMethodId, storedMethodId } from '@/lib/accounts/resolve'
import { reconcileDebtSchedule } from '@/lib/debts/recurringDebtDueHandlers'
import { manualOccurredAt } from '@/lib/time/occurredAt'
import { computeDebtPaymentRecord } from '@/lib/utils/calculations'
import { localTodayISO } from '@/lib/utils/localDate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Debt } from '@/lib/store/types'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { moneyFlex } from './accountDisplay'

interface PayCardSheetProps {
  open: boolean
  onClose: () => void
  /** The card's credit-card debt. */
  debt: Debt
  /** The card's name, for the title. */
  name: string
  /** Everything owed on the card, plans included (cardOwed). */
  owed: number
  /** What is due now: owed minus plan principal not billed yet (cardHoldBack). The "Full amount" chip. */
  dueNow: number
  /** This month's instalments of the card's plans, for the line under the amount. */
  plansDue: number
  zClassName?: string
}

/**
 * Pay card (final UI v9): the shared inline-currency amount, a centred "Full amount" chip (what is due now, this month's
 * instalments included), From and Date. Saved as one payment to the card's debt, the way Debts records a card payment:
 * the money leaves the account and what is owed goes down; it is not spending.
 */
export function PayCardSheet({ open, onClose, debt, name, owed, dueNow, plansDue, zClassName = 'z-[120]' }: PayCardSheetProps) {
  const c = useAccountsLtCopy().v9
  const toast = useActionToast()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const debtPayments = useFinanceStore((s) => s.debtPayments)
  const settings = useFinanceStore((s) => s.settings)
  const cur = String(debt.currency)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(cur)
  const [date, setDate] = useState(() => localTodayISO())
  const [from, setFrom] = useState(() => paysFrom(debt, { paymentMethods, debtPayments }) ?? defaultMethodId(paymentMethods))
  const [error, setError] = useState('')
  const money = (n: number) => moneyFlex(n, cur)
  const full = Math.round(dueNow * 100) / 100
  const typed = parseFloat(amount)
  const isFull = currency === cur && Math.abs(typed - full) < 0.005

  const line = currency !== cur || !(typed > 0)
    ? c.dueNow(money(full))
    : typed >= full - 0.005
      ? (plansDue > 0 ? c.clearsWithPlans(money(Math.max(0, full - plansDue)), money(plansDue)) : c.clears(money(full)))
      : c.leftAfter(money(Math.max(0, full - typed)))

  const save = () => {
    if (!(typed > 0)) return
    const s = useFinanceStore.getState()
    const rec = computeDebtPaymentRecord(debt, typed, currency, settings.baseCurrency, s.exchangeRates, s.goldPricePerGram, s.debtPayments,
      { expenses: s.expenses, exchangeRates: s.exchangeRates, allDebts: s.debts })
    if (!rec.ok) { setError(rec.error); return }
    s.addDebtPayment({
      debtId: debt.id,
      date,
      occurredAt: manualOccurredAt(date),
      amountPaid: rec.amountInDebtUnit,
      paymentMethodId: storedMethodId(from, s.paymentMethods),
      paymentCurrency: currency,
      originalAmount: typed,
      amountInPrimary: rec.amountInBase,
      rateAtEntry: rec.rateAtEntry,
    })
    reconcileDebtSchedule(debt.id, { amount: typed, currency })
    toast(c.paySaved)
    onClose()
  }

  return (
    <SheetFrame open={open} onClose={onClose} title={c.payTitle(name)} zClassName={zClassName}
      footer={<Button size="cta-block" onClick={save} disabled={!(typed > 0) || !from}>{c.payCard}</Button>}>
      <AmountHero value={amount} onChange={(v) => { setAmount(v); setError('') }} currency={currency}
        onCurrencyChange={(code) => { setCurrency(code); setError('') }} base={settings.baseCurrency} line={line} className="px-0 pb-0" />
      {owed > 0 ? (
        <div className="-mt-2 flex justify-center">
          <OptionChip selected={isFull} onClick={() => { setCurrency(cur); setAmount(String(full)); setError('') }} className="h-11 rounded-full px-4 text-[0.875rem]">
            {c.fullAmount} <span className="font-mono-numbers">{money(full)}</span>
          </OptionChip>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-center text-xs text-[var(--color-brand-red)]">{error}</p> : null}
      <section>
        <Card padding="none" divide className="overflow-hidden rounded-2xl">
          <MethodPickerRow label={c.from} value={from} onChange={setFrom} paymentMethods={paymentMethods} accountsOnly />
          <div className="flex min-h-[52px] items-center gap-3 px-4">
            <span className="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">{c.date}</span>
            <DatePickerField look="pill" value={date} onChange={setDate} />
          </div>
        </Card>
        <p className="mt-2 px-1 text-xs leading-relaxed text-[var(--color-brand-text-secondary)]">{c.payNote}</p>
      </section>
    </SheetFrame>
  )
}
