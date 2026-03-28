'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import { getField } from '@/lib/ai/aiActionHandlers'
import type { AIAction } from '@/lib/ai/gemini'
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
        <p>🏦 Debt payment to {String(getField(d, 'person', 'debtName', 'name') || '?')}</p>
        <p>
          💰 {formatCurrency(Number(getField(d, 'amount')) || 0, String(getField(d, 'currency') || baseCurrency))}
        </p>
        {getField(d, 'paymentMethod', 'payment_method') ? (
          <p>💳 {String(getField(d, 'paymentMethod', 'payment_method'))}</p>
        ) : null}
        <p className="text-[var(--color-brand-text-muted)]">Also recorded as Debt expense</p>
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
  return null
}
