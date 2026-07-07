'use client'

import { Check, Trash2, Mic, X, AlertCircle } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { getField } from '@/lib/ai/aiActionHandlers'
import type { AIAction, AIActionItem } from '@/lib/ai/gemini'
import { EXPENSE_ENTRY_CATEGORIES, FIAT_CURRENCIES } from '@/lib/constants/finance'

export interface VoiceRecapEditorProps {
  actions: AIActionItem[]
  itemErrors: (string | null)[]
  transcript: string | null
  onUpdateField: (index: number, key: string, value: unknown) => void
  onRemove: (index: number) => void
  onConfirm: () => void
  onRedo: () => void
  onCancel: () => void
  /** Compact spacing for the floating overlay vs. the roomy bottom sheet. */
  compact?: boolean
}

const ACTION_META: Record<string, { emoji: string; label: string }> = {
  add_expense: { emoji: '📝', label: 'Expense' },
  add_income: { emoji: '💵', label: 'Income' },
  add_debt: { emoji: '🤝', label: 'Debt' },
  add_debt_payment: { emoji: '🏦', label: 'Debt payment' },
  deposit_savings: { emoji: '🐷', label: 'Savings deposit' },
  withdraw_savings: { emoji: '🏧', label: 'Savings withdrawal' },
  add_savings_account: { emoji: '🏦', label: 'Savings account' },
  add_payment_method: { emoji: '💳', label: 'Payment method' },
}

function primaryField(action: AIAction): { key: string; label: string } {
  switch (action) {
    case 'add_income': return { key: 'name', label: 'Source' }
    case 'add_debt': return { key: 'name', label: 'Debt name' }
    case 'add_debt_payment': return { key: 'person', label: 'Person' }
    case 'deposit_savings':
    case 'withdraw_savings': return { key: 'account', label: 'Account' }
    case 'add_savings_account': return { key: 'name', label: 'Account name' }
    case 'add_payment_method': return { key: 'name', label: 'Name' }
    default: return { key: 'description', label: 'Description' }
  }
}

const FIELD_CLS =
  'w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-2.5 py-2 text-sm text-[var(--color-brand-text-primary)] focus:outline-none focus:border-[var(--color-brand-red)]'

/**
 * Editable recap shown after voice extraction: one card per detected transaction
 * with the common fields editable, per-item validation errors, and remove. Shared
 * by the bottom sheet and the floating overlay.
 */
export function VoiceRecapEditor({
  actions,
  itemErrors,
  transcript,
  onUpdateField,
  onRemove,
  onConfirm,
  onRedo,
  onCancel,
  compact = false,
}: VoiceRecapEditorProps) {
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const multiple = actions.length > 1

  return (
    <div className={compact ? 'px-4 py-3' : 'w-full'}>
      <div className="flex items-center justify-between">
        <h3 className={compact ? 'text-sm font-semibold text-[var(--color-brand-text-primary)]' : 'text-base font-semibold text-[var(--color-brand-text-primary)]'}>
          {actions.length === 0 ? 'Nothing to save' : multiple ? `${actions.length} transactions` : 'Confirm to save'}
        </h3>
        {transcript && !compact ? (
          <span className="text-[10px] text-[var(--color-brand-text-muted)] truncate max-w-[45%]">&ldquo;{transcript}&rdquo;</span>
        ) : null}
      </div>

      <div className={`mt-2 space-y-2 overflow-y-auto ${compact ? 'max-h-[46vh]' : 'max-h-[48vh]'}`}>
        {actions.map((item, idx) => {
          const action = item.action
          const meta = ACTION_META[action] ?? { emoji: '•', label: action }
          const pf = primaryField(action)
          const showAmount = action !== 'add_payment_method'
          const showCurrency = action !== 'add_payment_method'
          const showCategory = action === 'add_expense'
          const showPayment = action === 'add_expense' || action === 'add_debt_payment' || action === 'add_income'
          const err = itemErrors[idx]
          const pmValue = String(getField(item.data, 'paymentMethod', 'payment_method') ?? '')

          return (
            <div
              key={idx}
              className={`rounded-xl border bg-[var(--color-brand-elevated)]/50 p-2.5 ${err ? 'border-[var(--color-brand-red)]' : 'border-[var(--color-brand-border)]'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">
                  {meta.emoji} {meta.label}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="rounded-md p-1 text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] hover:text-[var(--color-brand-red)]"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="col-span-2 block">
                  <span className="mb-0.5 block text-[10px] text-[var(--color-brand-text-muted)]">{pf.label}</span>
                  <input
                    className={FIELD_CLS}
                    value={String(getField(item.data, pf.key) ?? '')}
                    onChange={(e) => onUpdateField(idx, pf.key, e.target.value)}
                  />
                </label>

                {showAmount ? (
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-[var(--color-brand-text-muted)]">Amount</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className={FIELD_CLS}
                      value={String(getField(item.data, 'amount') ?? '')}
                      onChange={(e) => onUpdateField(idx, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </label>
                ) : null}

                {showCurrency ? (
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-[var(--color-brand-text-muted)]">Currency</span>
                    <select
                      className={FIELD_CLS}
                      value={String(getField(item.data, 'currency') ?? baseCurrency)}
                      onChange={(e) => onUpdateField(idx, 'currency', e.target.value)}
                    >
                      {FIAT_CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {showCategory ? (
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-[var(--color-brand-text-muted)]">Category</span>
                    <select
                      className={FIELD_CLS}
                      value={String(getField(item.data, 'category') ?? 'Other')}
                      onChange={(e) => onUpdateField(idx, 'category', e.target.value)}
                    >
                      {EXPENSE_ENTRY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {showPayment ? (
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-[var(--color-brand-text-muted)]">Payment method</span>
                    <select
                      className={FIELD_CLS}
                      value={pmValue}
                      onChange={(e) => onUpdateField(idx, 'paymentMethod', e.target.value)}
                    >
                      <option value="">—</option>
                      {pmValue && !paymentMethods.some((m) => m.name === pmValue) ? (
                        <option value={pmValue}>{pmValue}</option>
                      ) : null}
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {err ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-brand-red)]">
                  <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={actions.length === 0}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> {multiple ? 'Save all' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-brand-border)] px-3 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          <Mic className="h-4 w-4" /> Redo
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-2.5 py-2.5 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
