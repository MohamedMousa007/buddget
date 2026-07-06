'use client'

import type { Expense } from '@/lib/store/types'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useEditExpenseForm } from '@/hooks/useEditExpenseForm'
import { ExpenseSheetForm } from '@/components/features/expenses/ExpenseSheetForm'

export function EditExpenseForm({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  useEscapeClose(true, onClose)
  const f = useEditExpenseForm(expense, onClose)

  const isDirty =
    f.date !== expense.date ||
    f.description !== expense.description ||
    f.amount !== expense.amount.toString() ||
    f.currency !== expense.currency ||
    f.category !== expense.category ||
    f.paymentMethodId !== expense.paymentMethodId ||
    (f.notes || '') !== (expense.notes || '')

  const onDiscard = () => {
    f.setDate(expense.date)
    f.setDescription(expense.description)
    f.setAmount(expense.amount.toString())
    f.setCurrency(expense.currency)
    f.setCategory(expense.category)
    f.setPaymentMethodId(expense.paymentMethodId)
    f.setNotes(expense.notes || '')
  }

  return (
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
      submitError={f.submitError}
      paymentMethods={f.paymentMethods}
      creditCardOutstandingHint={null}
      onSubmit={f.handleSubmit}
      onClose={onClose}
      isDirty={isDirty}
      onDiscard={onDiscard}
    />
  )
}
