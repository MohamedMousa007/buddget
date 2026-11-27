'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense } from '@/lib/store/types'
import { RepaidSheet } from '@/components/features/spending/RepaidSheet'
import { useEditExpenseForm } from '@/hooks/useEditExpenseForm'
import { useLinkedDelete } from '@/hooks/useLinkedDelete'
import { ExpenseSheetForm, type ExpenseOrigin } from '@/components/features/expenses/ExpenseSheetForm'
import { useT } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { cardBankName } from '@/lib/payment/cardThemes'
import { expenseAmountInBase, getMonthRange } from '@/lib/utils/calculations'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { format } from 'date-fns'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { amountInputText } from '@/lib/ui/amountSanitize'

export function EditExpenseForm({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const f = useEditExpenseForm(expense, onClose)
  const { removeExpense } = useLinkedDelete()
  const [repaidOpen, setRepaidOpen] = useState(false)
  const hasReceipt = useFinanceStore((s) => !!expense.receiptId && s.receipts.some((r) => r.id === expense.receiptId))
  const t = useT()
  const lt = useFlowLtCopy()
  const confirm = useConfirm()
  const { paymentMethods, base, rates, monthStartDay } = useFinanceStore(
    useShallow((s) => ({ paymentMethods: s.paymentMethods, base: s.settings.baseCurrency, rates: s.exchangeRates, monthStartDay: s.settings.monthStartDay })),
  )
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const pairedDebt = useFinanceStore((s) => {
    const payment = expense.linkedDebtPaymentId ? s.debtPayments.find((p) => p.id === expense.linkedDebtPaymentId) : undefined
    const debt = payment ? s.debts.find((d) => d.id === payment.debtId) : undefined
    return payment ? debt?.name || debt?.person || '' : null
  })
  const pm = paymentMethods.find((m) => m.id === expense.paymentMethodId)
  const parent = pm?.parentId ? paymentMethods.find((m) => m.id === pm.parentId) : undefined
  const origin: ExpenseOrigin = hasReceipt
    ? { kind: 'receipt' }
    : expense.smsLogId
      ? { kind: 'sms', bank: pm ? cardBankName(pm, parent) : undefined }
      : { kind: 'manual' }
  // The saved amount sits in this month's budget totals only when it counts; the sheet gives it back to show "left".
  const cycle = getMonthRange(monthFilter, monthStartDay)
  const inCycle = expense.date >= format(cycle.start, 'yyyy-MM-dd') && expense.date <= format(cycle.end, 'yyyy-MM-dd')
  const counted = inCycle && !expense.refundKind && !isNonSpendExpense(expense)
  const saved = counted ? { category: expense.category, amountBase: expenseAmountInBase(expense, base, rates) } : undefined

  const isDirty =
    f.date !== expense.date ||
    f.clock !== f.savedClock ||
    f.description !== expense.description ||
    f.amount !== amountInputText(expense.amount, expense.currency) ||
    f.currency !== expense.currency ||
    f.category !== expense.category ||
    f.paymentMethodId !== expense.paymentMethodId ||
    (f.notes || '') !== (expense.notes || '') ||
    f.exclusion.value !== expense.spendExclusion ||
    (f.exclusion.value === 'for_someone' && f.exclusion.owedBy.trim() !== (expense.owedBy ?? ''))

  const onDiscard = () => {
    f.setDate(expense.date)
    f.setClock(f.savedClock)
    f.setDescription(expense.description)
    f.setAmount(amountInputText(expense.amount, expense.currency))
    f.setCurrency(expense.currency)
    f.setCategory(expense.category)
    f.setPaymentMethodId(expense.paymentMethodId)
    f.setNotes(expense.notes || '')
    f.exclusion.setValue(expense.spendExclusion)
    f.exclusion.setOwedBy(expense.owedBy ?? '')
  }

  return (
    <>
    <ExpenseSheetForm
      mode="edit"
      date={f.date}
      setDate={f.setDate}
      description={f.description}
      setDescription={f.setDescription}
      amount={f.amount}
      setAmount={f.setAmount}
      currency={f.currency}
      setCurrency={f.setCurrency}
      category={f.category}
      setCategory={f.setCategory}
      paymentMethodId={f.paymentMethodId}
      setPaymentMethodId={f.setPaymentMethodId}
      notes={f.notes}
      setNotes={f.setNotes}
      exclusion={f.exclusion}
      submitError={f.submitError}
      paymentMethods={f.paymentMethods}
      creditCardOutstandingHint={null}
      onSubmit={f.handleSubmit}
      onClose={onClose}
      isDirty={isDirty}
      onDiscard={onDiscard}
      clock={f.clock}
      setClock={f.setClock}
      refundedAt={expense.refundedAt}
      refundKind={expense.refundKind}
      onMarkRepaid={expense.spendExclusion === 'for_someone' ? () => setRepaidOpen(true) : undefined}
      owedSettled={Boolean(expense.owedSettledAt)}
      receiptId={hasReceipt ? expense.receiptId : undefined}
      origin={origin}
      saved={saved}
      lockedNote={pairedDebt === null ? undefined : lt.expense.pairedNote(pairedDebt)}
      onDelete={async () => {
        // A debt payment's expense asks its own question inside removeExpense; a plain one asks here, then offers Undo.
        const paired = expense.linkedDebtPaymentId && useFinanceStore.getState().debtPayments.some((p) => p.id === expense.linkedDebtPaymentId)
        if (!paired && !(await confirm({ title: lt.expense.deleteTitle, body: lt.expense.deleteBody(expense.description), confirmLabel: t.common.delete, destructive: true }))) return false
        const done = await removeExpense(expense)
        if (done) onClose()
        return done
      }}
    />
    {repaidOpen ? <RepaidSheet open expense={expense} onClose={() => setRepaidOpen(false)} onDone={onClose} /> : null}
    </>
  )
}
