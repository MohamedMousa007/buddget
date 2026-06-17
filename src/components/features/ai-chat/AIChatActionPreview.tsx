'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import { getField } from '@/lib/ai/aiActionHandlers'
import { friendlyLineForActionItem, type AIAction } from '@/lib/ai/gemini'
import type { Currency } from '@/lib/store/types'

export interface AIChatActionPreviewProps {
  action: AIAction
  data: Record<string, unknown>
  baseCurrency: Currency
}

/**
 * Renders one proposed AI action (expense, debt payment, etc.) inside the confirmation card.
 */
export function AIChatActionPreview({ action, data: d, baseCurrency }: AIChatActionPreviewProps) {
  if (action === 'add_expense') {
    return (
      <>
        <p>📝 {String(getField(d, 'description') || 'Expense')}</p>
        <p>📂 Category: {String(getField(d, 'category') || 'Other')}</p>
        <p>
          💰 {formatCurrency(Number(getField(d, 'amount')) || 0, String(getField(d, 'currency') || baseCurrency))}
        </p>
        {getField(d, 'paymentMethod', 'payment_method') ? (
          <p>💳 {String(getField(d, 'paymentMethod', 'payment_method'))}</p>
        ) : null}
      </>
    )
  }
  if (action === 'add_debt_payment') {
    return (
      <>
        <p>🏦 Balance payment to {String(getField(d, 'person', 'debtName', 'name') || '?')}</p>
        <p>
          💰 {formatCurrency(Number(getField(d, 'amount')) || 0, String(getField(d, 'currency') || baseCurrency))}
        </p>
        {getField(d, 'paymentMethod', 'payment_method') ? (
          <p>💳 {String(getField(d, 'paymentMethod', 'payment_method'))}</p>
        ) : null}
        <p className="text-[var(--color-brand-text-muted)]">Also tracked as a balance expense</p>
      </>
    )
  }
  if (action === 'add_income') {
    return (
      <>
        <p>💵 {String(getField(d, 'name') || 'Income')}</p>
        <p>
          💰 {formatCurrency(Number(getField(d, 'amount')) || 0, String(getField(d, 'currency') || baseCurrency))}
        </p>
        {getField(d, 'isRecurring', 'is_recurring') === false ? null : (
          <p className="text-[var(--color-brand-text-muted)]">
            🔄 {String(getField(d, 'recurringFrequency', 'recurring_frequency') || 'monthly')}
            {String(getField(d, 'recurringFrequency', 'recurring_frequency') || 'monthly') === 'monthly' &&
            getField(d, 'dayOfMonth', 'day_of_month') != null
              ? ` · day ${String(getField(d, 'dayOfMonth', 'day_of_month'))}`
              : null}
          </p>
        )}
      </>
    )
  }
  if (action === 'add_payment_method') {
    return (
      <>
        <p>💳 {String(getField(d, 'name') || 'Payment method')}</p>
        <p>Type: {String(getField(d, 'type') || 'other')}</p>
      </>
    )
  }
  if (action === 'add_savings_holding') {
    return (
      <>
        <p>🏦 {String(getField(d, 'name') || 'Holding')}</p>
        <p>
          💰 {formatCurrency(Number(getField(d, 'amount')) || 0, String(getField(d, 'currency') || baseCurrency))}
        </p>
        <p>
          {String(getField(d, 'bucket') || 'liquid')} · {String(getField(d, 'subtype') || 'other')}
        </p>
      </>
    )
  }
  if (action === 'update_budget_category') {
    return (
      <>
        <p>📂 Category: {String(getField(d, 'category') || '?')}</p>
        {getField(d, 'percentOfIncome', 'percent') != null && getField(d, 'percentOfIncome', 'percent') !== '' ? (
          <p>📊 {String(getField(d, 'percentOfIncome', 'percent'))}% of income</p>
        ) : (
          <p>💰 {formatCurrency(Number(getField(d, 'budgetedAmount', 'amount')) || 0, baseCurrency)}</p>
        )}
      </>
    )
  }
  if (action === 'add_debt') {
    return (
      <>
        <p>🤝 {String(getField(d, 'name') || getField(d, 'person') || 'Debt')}</p>
        <p>💰 {formatCurrency(Number(getField(d, 'amount')) || 0, String(getField(d, 'currency') || baseCurrency))}</p>
        <p className="text-[var(--color-brand-text-muted)]">
          {getField(d, 'direction') === 'they_owe' ? 'They owe you' : 'You owe'}
          {getField(d, 'person') ? ` · ${String(getField(d, 'person'))}` : ''}
        </p>
      </>
    )
  }
  if (action === 'deposit_savings' || action === 'withdraw_savings') {
    const isDeposit = action === 'deposit_savings'
    return (
      <>
        <p>{isDeposit ? '🐷' : '🏧'} {isDeposit ? 'Deposit to' : 'Withdraw from'} {String(getField(d, 'account', 'name') || '?')}</p>
        <p>💰 {formatCurrency(Number(getField(d, 'amount')) || 0, String(getField(d, 'currency') || baseCurrency))}</p>
      </>
    )
  }
  if (action === 'add_savings_account') {
    return (
      <>
        <p>🏦 {String(getField(d, 'name') || 'Savings account')}</p>
        <p className="text-[var(--color-brand-text-muted)]">
          {String(getField(d, 'category') || 'savings')} · {String(getField(d, 'type') || 'bank')}
        </p>
        {Number(getField(d, 'openingBalance')) > 0 ? (
          <p>💰 {formatCurrency(Number(getField(d, 'openingBalance')) || 0, String(getField(d, 'currency') || baseCurrency))}</p>
        ) : null}
      </>
    )
  }
  if (action === 'add_goal') {
    const target = Number(getField(d, 'targetAmount'))
    return (
      <>
        <p>🎯 {String(getField(d, 'name') || getField(d, 'category') || 'Goal')}</p>
        {target > 0 ? <p>💰 {formatCurrency(target, String(getField(d, 'currency') || baseCurrency))}</p> : null}
        {getField(d, 'targetDate') ? (
          <p className="text-[var(--color-brand-text-muted)]">By {String(getField(d, 'targetDate'))}</p>
        ) : null}
      </>
    )
  }
  if (action === 'clear_debt') {
    return <p>✅ Mark &ldquo;{String(getField(d, 'name', 'person') || '')}&rdquo; as paid off</p>
  }
  // Fallback for any remaining actionable type (update_*/delete_*/plan edits) —
  // never render an empty row in a multi-action list.
  return <p>{friendlyLineForActionItem(action, d)}</p>
}
