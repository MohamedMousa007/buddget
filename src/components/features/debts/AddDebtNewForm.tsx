'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import type { AppSettings, DebtCurrency, GoldKarat } from '@/lib/store/types'

export interface AddDebtNewFormProps {
  settings: AppSettings
  name: string
  setName: (v: string) => void
  person: string
  setPerson: (v: string) => void
  description: string
  setDescription: (v: string) => void
  isGold: boolean
  setIsGold: (v: boolean) => void
  startingBalance: string
  setStartingBalance: (v: string) => void
  currency: DebtCurrency
  setCurrency: (v: DebtCurrency) => void
  goldKarat: GoldKarat
  setGoldKarat: (v: GoldKarat) => void
  notes: string
  setNotes: (v: string) => void
  onCancel: () => void
  onSubmit: () => void
}

/**
 * Fields for creating a new debt (fiat or gold).
 */
export function AddDebtNewForm({
  settings,
  name,
  setName,
  person,
  setPerson,
  description,
  setDescription,
  isGold,
  setIsGold,
  startingBalance,
  setStartingBalance,
  currency,
  setCurrency,
  goldKarat,
  setGoldKarat,
  notes,
  setNotes,
  onCancel,
  onSubmit,
}: AddDebtNewFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Debt Name</Label>
        <Input
          placeholder="e.g. Mom's Debt"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Person</Label>
        <Input
          placeholder="Who do you owe?"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Description (optional)</Label>
        <Input
          placeholder="e.g. Gold jewelry, Wedding loan..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Gold Debt?</Label>
        <Switch
          checked={isGold}
          onCheckedChange={(val) => {
            setIsGold(val)
            if (val) setCurrency('XAU')
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
              <option value="24">24K (99.9%)</option>
              <option value="22">22K (91.7%)</option>
              <option value="21">21K (87.5%)</option>
              <option value="18">18K (75%)</option>
            </select>
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!name || !person || !startingBalance}
          className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Add Debt →
        </button>
      </div>
    </div>
  )
}
