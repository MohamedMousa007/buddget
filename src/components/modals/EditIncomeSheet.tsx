'use client'

import { useState } from 'react'
import { useEscapeClose } from '@/lib/hooks/useEscapeClose'
import { X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { Currency, IncomeSource } from '@/lib/store/types'

function EditIncomeForm({ source, onClose }: { source: IncomeSource; onClose: () => void }) {
  const { updateIncomeSource, settings } = useFinanceStore()

  useEscapeClose(true, onClose)

  const [name, setName] = useState(source.name)
  const [amount, setAmount] = useState(source.amount.toString())
  const [currency, setCurrency] = useState<Currency>(source.currency)
  const [isRecurring, setIsRecurring] = useState(source.isRecurring)
  const [dayOfMonth, setDayOfMonth] = useState(String(source.dayOfMonth ?? 1))
  const [notes, setNotes] = useState(source.notes || '')

  const handleSubmit = () => {
    if (!name || !amount || parseFloat(amount) <= 0) return
    updateIncomeSource(source.id, {
      name,
      amount: parseFloat(amount),
      currency,
      isRecurring,
      dayOfMonth: isRecurring ? parseInt(dayOfMonth, 10) || 1 : undefined,
      notes: notes || undefined,
    })
    onClose()
  }

  return (
    <div className="p-6">
      <div className="w-10 h-1 bg-[var(--color-brand-border)] rounded-full mx-auto mb-4 lg:hidden" />
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Edit Income</h3>
        <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors">
          <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Source Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers" />
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm">
              {FIAT_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Recurring monthly?</Label>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>
        {isRecurring && (
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Day of Month</Label>
            <Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="mt-1 w-24 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers" />
          </div>
        )}
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]" />
        </div>
        <p className="text-[10px] text-[var(--color-brand-text-muted)]">Budgets in &quot;% of income&quot; use recurring income converted to {settings.baseCurrency}.</p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)]">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={!name || !amount} className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-semibold disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export function EditIncomeSheet() {
  const { incomeSources } = useFinanceStore()
  const { activeModal, setActiveModal, editingIncomeId, setEditingIncomeId } = useSettingsStore()
  const isOpen = activeModal === 'editIncome'
  const source = incomeSources.find((s) => s.id === editingIncomeId)

  const close = () => {
    setActiveModal(null)
    setEditingIncomeId(null)
  }

  const shellOpen = isOpen && !!source

  return (
    <ModalShell open={shellOpen} onBackdropClick={close}>
      {source ? <EditIncomeForm key={source.id} source={source} onClose={close} /> : null}
    </ModalShell>
  )
}
