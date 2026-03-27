'use client'

import { useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import { clampDebtFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { DebtCurrency, GoldKarat } from '@/lib/store/types'

export type DebtOnboardingPayload = {
  entries: Array<{
    name: string
    person: string
    description?: string
    startingBalance: number
    currency: DebtCurrency
    isGold: boolean
    goldKarat?: GoldKarat
    notes?: string
  }>
}

/** Same fields as Add New Debt in the app — list + add, or skip with none. */
export function DebtOnboardingPanel({
  entries,
  onChange,
}: {
  entries: DebtOnboardingPayload['entries']
  onChange: (p: DebtOnboardingPayload) => void
}) {
  const settings = useFinanceStore((s) => s.settings)

  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>(
    () => useFinanceStore.getState().settings.baseCurrency as DebtCurrency
  )
  const [isGold, setIsGold] = useState(false)
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
  const [notes, setNotes] = useState('')

  const emit = (next: DebtOnboardingPayload['entries']) => {
    onChange({ entries: next })
  }

  const addRow = () => {
    if (!name.trim() || !person.trim() || !startingBalance) return
    const bal = parseFloat(startingBalance)
    if (!Number.isFinite(bal)) return
    emit([
      ...entries,
      {
        name: name.trim(),
        person: person.trim(),
        description: description.trim() || undefined,
        startingBalance: bal,
        currency: isGold ? 'XAU' : clampDebtFiatToAllowed(settings, currency),
        isGold,
        goldKarat: isGold ? goldKarat : undefined,
        notes: notes.trim() || undefined,
      },
    ])
    setName('')
    setPerson('')
    setDescription('')
    setStartingBalance('')
    setCurrency(settings.baseCurrency as DebtCurrency)
    setIsGold(false)
    setGoldKarat(24)
    setNotes('')
  }

  const removeAt = (i: number) => {
    emit(entries.filter((_, j) => j !== i))
  }

  return (
    <div className="space-y-4 text-left w-full max-w-lg">
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">
        Same details as Debts in the app. Add what you owe, or skip if you’ll do it later.
      </p>

      {entries.length > 0 ? (
        <ul className="rounded-xl border border-[var(--color-brand-border)] divide-y divide-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 text-sm">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-white truncate">
                {e.name} · {e.person} · {e.startingBalance} {e.currency}
                {e.isGold ? ` (${e.goldKarat}K)` : ''}
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
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Debt name</Label>
          <Input
            placeholder="e.g. Credit card"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Person / lender</Label>
          <Input
            placeholder="Who do you owe?"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Description (optional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Gold debt?</Label>
          <Switch
            checked={isGold}
            onCheckedChange={(v) => {
              setIsGold(v)
              if (v) setCurrency('XAU')
              else setCurrency(settings.baseCurrency as DebtCurrency)
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">
              {isGold ? 'Amount (grams)' : 'Amount'}
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
            />
          </div>
          {!isGold ? (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
              <DebtFiatCurrencySelect
                value={currency}
                onChange={setCurrency}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Karat</Label>
              <select
                value={goldKarat}
                onChange={(e) => setGoldKarat(parseInt(e.target.value, 10) as GoldKarat)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                <option value={24}>24K</option>
                <option value={22}>22K</option>
                <option value={21}>21K</option>
                <option value={18}>18K</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[50px]"
          />
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={!name.trim() || !person.trim() || !startingBalance}
          className="w-full py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-white hover:bg-[var(--color-brand-elevated)] disabled:opacity-40"
        >
          Add this debt
        </button>
      </div>
    </div>
  )
}
