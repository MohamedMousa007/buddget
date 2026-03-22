'use client'

import { useState } from 'react'
import { useEscapeClose } from '@/lib/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { X } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { Currency } from '@/lib/store/types'

export function AddIncomeSheet() {
  const { addIncomeSource, settings } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const isOpen = activeModal === 'addIncome'

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [isRecurring, setIsRecurring] = useState(true)
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setIsRecurring(true)
    setDayOfMonth('1')
    setNotes('')
  }

  const handleSubmit = () => {
    if (!name || !amount || parseFloat(amount) <= 0) return

    addIncomeSource({
      name,
      amount: parseFloat(amount),
      currency,
      isRecurring,
      dayOfMonth: isRecurring ? parseInt(dayOfMonth) : undefined,
      notes: notes || undefined,
    })

    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
            <div className="p-6">
              <div className="w-10 h-1 bg-[var(--color-brand-border)] rounded-full mx-auto mb-4 lg:hidden" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Add Income Source</h3>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Source Name</Label>
                  <Input
                    placeholder="e.g. Bask Health, Freelance"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
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
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers placeholder:text-[var(--color-brand-text-muted)]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                    >
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
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers w-24"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
                  <Textarea
                    placeholder="Any extra details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)] min-h-[60px]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!name || !amount}
                    className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Income →
                  </button>
                </div>
              </div>
            </div>
    </ModalShell>
  )
}
