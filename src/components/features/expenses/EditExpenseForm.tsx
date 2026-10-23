'use client'

import { useState } from 'react'
import type { Expense } from '@/lib/store/types'
import { RepaidSheet } from '@/components/features/spending/RepaidSheet'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useEditExpenseForm } from '@/hooks/useEditExpenseForm'
import { ExpenseSheetForm } from '@/components/features/expenses/ExpenseSheetForm'

export function EditExpenseForm({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  useEscapeClose(true, onClose)
  const f = useEditExpenseForm(expense, onClose)
  const [repaidOpen, setRepaidOpen] = useState(false)

  const isDirty =
    f.date !== expense.date ||
    f.description !== expense.description ||
    f.amount !== expense.amount.toString() ||
    f.currency !== expense.currency ||
    f.category !== expense.category ||
    f.paymentMethodId !== expense.paymentMethodId ||
    (f.notes || '') !== (expense.notes || '') ||
    f.exclusion.value !== expense.spendExclusion ||
    (f.exclusion.value === 'for_someone' && f.exclusion.owedBy.trim() !== (expense.owedBy ?? ''))

  const onDiscard = () => {
    f.setDate(expense.date)
    f.setDescription(expense.description)
    f.setAmount(expense.amount.toString())
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
      refundedAt={expense.refundedAt}
      refundKind={expense.refundKind}
      onMarkRepaid={expense.spendExclusion === 'for_someone' ? () => setRepaidOpen(true) : undefined}
      owedSettled={Boolean(expense.owedSettledAt)}
    />
    {repaidOpen ? <RepaidSheet open expense={expense} onClose={() => setRepaidOpen(false)} onDone={onClose} /> : null}
    </>
  )
}
