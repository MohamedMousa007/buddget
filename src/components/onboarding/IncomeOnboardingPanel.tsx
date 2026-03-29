'use client'

import { useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Currency, IncomeRecurringFrequency, IncomeSource } from '@/lib/store/types'

const RECURRING_FREQ: { value: IncomeRecurringFrequency; label: string; amountHint: string }[] = [
  { value: 'monthly', label: 'Monthly', amountHint: 'This is your monthly amount.' },
  { value: 'biweekly', label: 'Bi-weekly', amountHint: 'Per paycheck — that’s 26 times a year.' },
  { value: 'weekly', label: 'Weekly', amountHint: 'This is your weekly amount.' },
]

export type IncomeOnboardingPayload = {
  entries: Omit<IncomeSource, 'id' | 'createdAt'>[]
}

/** Same fields as Add Income in the app — list + add, or skip with none. */
export function IncomeOnboardingPanel({
  entries,
  onChange,
}: {
  entries: Omit<IncomeSource, 'id' | 'createdAt'>[]
  onChange: (p: IncomeOnboardingPayload) => void
}) {
  const settings = useFinanceStore((s) => s.settings)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [isRecurring, setIsRecurring] = useState(true)
  const [recurringFrequency, setRecurringFrequency] = useState<IncomeRecurringFrequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [notes, setNotes] = useState('')

  const emit = (next: Omit<IncomeSource, 'id' | 'createdAt'>[]) => {
    onChange({ entries: next })
  }

  const addRow = () => {
    if (!name.trim() || !amount || parseFloat(amount) <= 0) return
    const row: Omit<IncomeSource, 'id' | 'createdAt'> = {
      name: name.trim(),
      amount: parseFloat(amount),
      currency: clampFiatToAllowed(settings, currency),
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      dayOfMonth: isRecurring && recurringFrequency === 'monthly' ? parseInt(dayOfMonth, 10) || 1 : undefined,
      notes: notes.trim() || undefined,
    }
    emit([...entries, row])
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setIsRecurring(true)
    setRecurringFrequency('monthly')
    setDayOfMonth('1')
    setNotes('')
  }

  const removeAt = (i: number) => {
    emit(entries.filter((_, j) => j !== i))
  }

  return (
    <div className="space-y-4 text-left w-full max-w-lg">
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">
        Add your income sources below — or skip this and come back to it anytime.
      </p>

      {entries.length > 0 ? (
        <ul className="rounded-xl border border-[var(--color-brand-border)] divide-y divide-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 text-sm">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-white truncate">
                {e.name} · {e.amount} {e.currency}
                {e.isRecurring ? ` · ${e.recurringFrequency ?? 'monthly'}` : ''}
              </span>
              <button type="button" onClick={() => removeAt(i)} className="text-xs text-[var(--color-brand-red)] shrink-0">
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-4 rounded-xl border border-[var(--color-brand-border)] p-4 bg-[var(--color-brand-elevated)]/30">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Source name</Label>
          <Input
            placeholder="e.g. Salary, Freelance, Side gig"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Amount</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
            <FiatCurrencySelect
              value={currency}
              onChange={setCurrency}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Is this recurring?</Label>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>
        {isRecurring && (
          <>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">How often do you get paid?</Label>
              <select
                value={recurringFrequency}
                onChange={(e) => setRecurringFrequency(e.target.value as IncomeRecurringFrequency)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                {RECURRING_FREQ.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">
                {RECURRING_FREQ.find((f) => f.value === recurringFrequency)?.amountHint}
              </p>
            </div>
            {recurringFrequency === 'monthly' && (
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">Which day of the month?</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className="mt-1 w-24 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
                />
              </div>
            )}
          </>
        )}
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Any notes? (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[50px]"
          />
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
          className="w-full py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-white hover:bg-[var(--color-brand-elevated)] disabled:opacity-40"
        >
          Add this income source
        </button>
      </div>
    </div>
  )
}
