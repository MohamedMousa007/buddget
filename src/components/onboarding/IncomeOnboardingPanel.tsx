'use client'

import { useMemo, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Currency, IncomeRecurringFrequency, IncomeSource } from '@/lib/store/types'

export type IncomeOnboardingPayload = {
  entries: Omit<IncomeSource, 'id' | 'createdAt'>[]
}

function recurringOptions(t: Dictionary) {
  const o = t.onboarding
  return [
    { value: 'monthly' as const, label: o.freqMonthly, amountHint: o.freqMonthlyHint },
    { value: 'biweekly' as const, label: o.freqBiweekly, amountHint: o.freqBiweeklyHint },
    { value: 'weekly' as const, label: o.freqWeekly, amountHint: o.freqWeeklyHint },
  ]
}

function recurringLabelForEntry(t: Dictionary, f: IncomeRecurringFrequency | undefined): string {
  const o = t.onboarding
  if (f === 'biweekly') return o.freqBiweekly
  if (f === 'weekly') return o.freqWeekly
  return o.freqMonthly
}

/** Same fields as Add Income in the app — list + add, or skip with none. */
export function IncomeOnboardingPanel({
  entries,
  onChange,
}: {
  entries: Omit<IncomeSource, 'id' | 'createdAt'>[]
  onChange: (p: IncomeOnboardingPayload) => void
}) {
  const t = useT()
  const o = t.onboarding
  const freqOpts = useMemo(() => recurringOptions(t), [t])
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
    <div className="space-y-4 text-start w-full max-w-lg">
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">{o.incomeIntro}</p>

      {entries.length > 0 ? (
        <ul className="rounded-xl border border-[var(--color-brand-border)] divide-y divide-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 text-sm">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-[var(--color-brand-text-primary)] truncate">
                {e.name} · {e.amount} {e.currency}
                {e.isRecurring ? ` · ${recurringLabelForEntry(t, e.recurringFrequency)}` : ''}
              </span>
              <button type="button" onClick={() => removeAt(i)} className="text-xs text-[var(--color-brand-red)] shrink-0">
                {o.incomeRemove}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-4 rounded-xl border border-[var(--color-brand-border)] p-4 bg-[var(--color-brand-elevated)]/30">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.incomeSourceName}</Label>
          <Input
            placeholder={o.incomeSourcePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.incomeAmountLabel}</Label>
            <Input
              type="number"
              step="0.01"
              placeholder={o.incomeAmountPlaceholder}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.incomeCurrency}</Label>
            <FiatCurrencySelect
              value={currency}
              onChange={setCurrency}
              className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.incomeIsRecurring}</Label>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>
        {isRecurring && (
          <>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.incomePayFrequency}</Label>
              <select
                value={recurringFrequency}
                onChange={(e) => setRecurringFrequency(e.target.value as IncomeRecurringFrequency)}
                className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
              >
                {freqOpts.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">
                {freqOpts.find((f) => f.value === recurringFrequency)?.amountHint}
              </p>
            </div>
            {recurringFrequency === 'monthly' && (
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.incomeDayOfMonth}</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className="mt-1 w-24 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
                />
              </div>
            )}
          </>
        )}
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.incomeNotes}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] min-h-[50px]"
          />
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
          className="w-full py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-40"
        >
          {o.incomeAddButton}
        </button>
      </div>
    </div>
  )
}
