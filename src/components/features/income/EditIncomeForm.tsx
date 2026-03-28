'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import type { IncomeSource, IncomeRecurringFrequency } from '@/lib/store/types'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useEditIncomeForm } from '@/hooks/useEditIncomeForm'
import { INCOME_RECURRING_FREQ_OPTIONS } from '@/lib/constants/incomeRecurring'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'

export function EditIncomeForm({ source, onClose }: { source: IncomeSource; onClose: () => void }) {
  useEscapeClose(true, onClose)
  const f = useEditIncomeForm(source, onClose)

  return (
    <div className="p-6">
      <ModalSheetHeader title="Edit Income" onClose={onClose} />

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Source Name</Label>
          <Input
            value={f.name}
            onChange={(e) => f.setName(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={f.amount}
              onChange={(e) => f.setAmount(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
            <FiatCurrencySelect
              value={f.currency}
              onChange={f.setCurrency}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Recurring income?</Label>
          <Switch checked={f.isRecurring} onCheckedChange={f.setIsRecurring} />
        </div>
        {f.isRecurring && (
          <>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">How often</Label>
              <select
                value={f.recurringFrequency}
                onChange={(e) => f.setRecurringFrequency(e.target.value as IncomeRecurringFrequency)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                {INCOME_RECURRING_FREQ_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">
                {INCOME_RECURRING_FREQ_OPTIONS.find((x) => x.value === f.recurringFrequency)?.amountHint}
                {' '}
                Budgets use a monthly equivalent (e.g. weekly × 52÷12).
              </p>
            </div>
            {f.recurringFrequency === 'monthly' && (
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">Day of month</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={f.dayOfMonth}
                  onChange={(e) => f.setDayOfMonth(e.target.value)}
                  className="mt-1 w-24 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
                />
              </div>
            )}
          </>
        )}
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes</Label>
          <Textarea
            value={f.notes}
            onChange={(e) => f.setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]"
          />
        </div>
        <p className="text-[10px] text-[var(--color-brand-text-muted)]">
          Budgets in &quot;% of income&quot; use recurring income converted to {f.baseCurrency}.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={f.handleSubmit}
            disabled={!f.name || !f.amount}
            className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-semibold disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
