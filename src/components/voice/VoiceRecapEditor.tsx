'use client'

import { Check, Trash2, Mic, X, AlertCircle } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { getField } from '@/lib/ai/aiActionHandlers'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { AIAction, AIActionItem } from '@/lib/ai/gemini'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { SelectField } from '@/components/ui/SelectField'
import { CategoryGlyph } from '@/components/dashboard/CategoryIcon'
import { useT, type Dictionary } from '@/lib/i18n'
import { IconButton } from '@/components/ui/IconButton'
import { useTypedAmount } from '@/hooks/useTypedAmount'

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

type VoiceActionKey = keyof Dictionary['voice']['recap']['actionLabels']
type VoiceFieldLabelKey = keyof Dictionary['voice']['recap']['fieldLabels']

const ACTION_EMOJI: Record<VoiceActionKey, string> = {
  add_expense: '📝',
  add_income: '💵',
  add_debt: '🤝',
  add_debt_payment: '🏦',
  deposit_savings: '🐷',
  withdraw_savings: '🏧',
  add_savings_account: '🏦',
  add_payment_method: '💳',
}

function primaryField(action: AIAction): { key: string; label: VoiceFieldLabelKey } {
  switch (action) {
    case 'add_income': return { key: 'name', label: 'source' }
    case 'add_debt': return { key: 'name', label: 'debtName' }
    case 'add_debt_payment': return { key: 'person', label: 'person' }
    case 'deposit_savings':
    case 'withdraw_savings': return { key: 'account', label: 'account' }
    case 'add_savings_account': return { key: 'name', label: 'accountName' }
    case 'add_payment_method': return { key: 'name', label: 'name' }
    default: return { key: 'description', label: 'description' }
  }
}

const FIELD_CLS =
  'w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-2.5 py-2 text-sm text-[var(--color-brand-text-primary)] focus:outline-none focus:border-[var(--color-brand-focus)]'

/** The recognised amount, kept as typed ("12.") while the stored value is a number or ''. */
function RecapAmount({ value, currency, onChange }: { value: unknown; currency: string; onChange: (v: number | '') => void }) {
  const [text, setText] = useTypedAmount(Number(value) || 0)
  return (
    <AmountField
      bare
      className={FIELD_CLS}
      value={text}
      decimalsFor={currency}
      onChange={(v) => {
        setText(v)
        onChange(v === '' ? '' : Number(v))
      }}
    />
  )
}

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
  const t = useT()
  const r = t.voice.recap
  const multiple = actions.length > 1

  return (
    <div className={compact ? 'px-4 py-3' : 'w-full'}>
      <div className="flex items-center justify-between">
        <h3 className={compact ? 'text-sm font-semibold text-[var(--color-brand-text-primary)]' : 'text-base font-semibold text-[var(--color-brand-text-primary)]'}>
          {actions.length === 0 ? r.nothingToSave : multiple ? r.transactionsCount(actions.length) : r.confirmToSave}
        </h3>
        {transcript && !compact ? (
          <span className="text-[0.625rem] text-[var(--color-brand-text-muted)] truncate max-w-[45%]">&ldquo;{transcript}&rdquo;</span>
        ) : null}
      </div>

      <div className={`mt-2 space-y-2 overflow-y-auto ${compact ? 'max-h-[46vh]' : 'max-h-[48vh]'}`}>
        {actions.map((item, idx) => {
          const action = item.action
          const actionLabels: Record<string, string> = r.actionLabels
          const meta = { emoji: ACTION_EMOJI[action as VoiceActionKey] ?? '•', label: actionLabels[action] ?? action }
          const pf = primaryField(action)
          const showAmount = action !== 'add_payment_method'
          const showCurrency = action !== 'add_payment_method'
          const showCategory = action === 'add_expense'
          const showPayment = action === 'add_expense' || action === 'add_debt_payment' || action === 'add_income'
          const err = itemErrors[idx]
          const pmValue = String(getField(item.data, 'paymentMethod', 'payment_method') ?? '')

          return (
            <Card
              key={idx}
              variant="elevated"
              radius="sm"
              padding="none"
              className={`bg-[var(--color-brand-elevated)]/50 p-2.5 ${err ? 'border-[var(--color-brand-primary)]' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">
                  {meta.emoji} {meta.label}
                </span>
                <IconButton onClick={() => onRemove(idx)} aria-label={t.a11y.removeItem}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="col-span-2 block">
                  <span className="mb-0.5 block text-[0.625rem] text-[var(--color-brand-text-muted)]">{r.fieldLabels[pf.label]}</span>
                  <input
                    className={FIELD_CLS}
                    value={String(getField(item.data, pf.key) ?? '')}
                    onChange={(e) => onUpdateField(idx, pf.key, e.target.value)}
                  />
                </label>

                {showAmount ? (
                  <label className="block">
                    <span className="mb-0.5 block text-[0.625rem] text-[var(--color-brand-text-muted)]">{r.amount}</span>
                    <RecapAmount
                      value={getField(item.data, 'amount')}
                      currency={String(getField(item.data, 'currency') ?? baseCurrency)}
                      onChange={(v) => onUpdateField(idx, 'amount', v)}
                    />
                  </label>
                ) : null}

                {showCurrency ? (
                  <label className="block">
                    <span className="mb-0.5 block text-[0.625rem] text-[var(--color-brand-text-muted)]">{r.currency}</span>
                    <CurrencyField
                      value={String(getField(item.data, 'currency') ?? baseCurrency)}
                      onChange={(c) => onUpdateField(idx, 'currency', c)}
                      className={`${FIELD_CLS} h-auto`}
                    />
                  </label>
                ) : null}

                {showCategory ? (
                  <div className="block">
                    <span className="mb-0.5 block text-[0.625rem] text-[var(--color-brand-text-muted)]">{r.category}</span>
                    <SelectField
                      aria-label={t.a11y.category}
                      value={String(getField(item.data, 'category') ?? 'Other')}
                      onChange={(c) => onUpdateField(idx, 'category', c)}
                      items={EXPENSE_ENTRY_CATEGORIES.map((c) => ({
                        value: c,
                        label: t.expenseForm.categoryLabels[c] ?? c,
                        glyph: <CategoryGlyph category={c} className="size-4" />,
                      }))}
                    />
                  </div>
                ) : null}

                {showPayment ? (
                  <label className="block">
                    <span className="mb-0.5 block text-[0.625rem] text-[var(--color-brand-text-muted)]">{r.paymentMethod}</span>
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
                <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-brand-primary-ink)]">
                  <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                </p>
              ) : null}
            </Card>
          )
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          onClick={onConfirm}
          disabled={actions.length === 0}
          size="touch"
          className="flex-1 gap-1.5 px-3 text-sm font-semibold"
        >
          <Check className="h-4 w-4" /> {multiple ? r.saveAll : r.save}
        </Button>
        <Button
          type="button"
          onClick={onRedo}
          variant="outline"
          size="touch"
          className="gap-1 bg-transparent px-3 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          <Mic className="h-4 w-4" /> {r.redo}
        </Button>
        <IconButton onClick={onCancel} aria-label={t.common.cancel}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}
