'use client'

import { useMemo, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
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
  const t = useT()
  const o = t.onboarding
  const karatItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: '24', label: t.goldPurity.k24 },
      { value: '22', label: t.goldPurity.k22 },
      { value: '21', label: t.goldPurity.k21 },
      { value: '18', label: t.goldPurity.k18 },
    ],
    [t.goldPurity],
  )
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
    <div className="space-y-4 text-start w-full max-w-lg">
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">{o.debtIntro}</p>

      {entries.length > 0 ? (
        <ul className="rounded-xl border border-[var(--color-brand-border)] divide-y divide-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 text-sm">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-[var(--color-brand-text-primary)] truncate">
                {e.name} · {e.person} · {e.startingBalance} {e.currency}
                {e.isGold ? ` (${e.goldKarat}K)` : ''}
              </span>
              <button type="button" onClick={() => removeAt(i)} className="text-xs text-[var(--color-brand-red)] shrink-0">
                {o.debtRemove}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-4 rounded-xl border border-[var(--color-brand-border)] p-4 bg-[var(--color-brand-elevated)]/30">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.debtNameLabel}</Label>
          <Input
            placeholder={o.debtNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.debtPersonLabel}</Label>
          <Input
            placeholder={o.debtPersonPlaceholder}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.debtDescLabel}</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.debtIsGold}</Label>
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
              {isGold ? o.debtAmountGrams : o.debtAmountLabel}
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder={o.debtAmountPlaceholder}
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
            />
          </div>
          {!isGold ? (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.debtCurrency}</Label>
              <DebtFiatCurrencySelect
                value={currency}
                onChange={setCurrency}
                className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.debtKarat}</Label>
              <SelectField
                value={String(goldKarat)}
                onChange={(v) => setGoldKarat(parseInt(v, 10) as GoldKarat)}
                items={karatItems}
                className="mt-1"
                aria-label={o.debtKarat}
              />
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{o.debtNotes}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] min-h-[50px]"
          />
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={!name.trim() || !person.trim() || !startingBalance}
          className="w-full py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-40"
        >
          {o.debtAddButton}
        </button>
      </div>
    </div>
  )
}
