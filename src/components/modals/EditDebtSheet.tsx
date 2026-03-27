'use client'

import { useState, useEffect } from 'react'
import { useEscapeClose } from '@/lib/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { X, Trash2 } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import { clampDebtFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { DebtCurrency, GoldKarat } from '@/lib/store/types'

export function EditDebtSheet() {
  const { debts, updateDebt, deleteDebt, settings } = useFinanceStore()
  const { activeModal, setActiveModal, editingDebtId, setEditingDebtId } = useSettingsStore()
  const isOpen = activeModal === 'editDebt'

  const debt = debts.find((d) => d.id === editingDebtId)

  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>('EGP')
  const [isGold, setIsGold] = useState(false)
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate form when editing debt opens */
    if (isOpen && debt) {
      setName(debt.name)
      setPerson(debt.person)
      setDescription(debt.description || '')
      setCurrency(debt.currency)
      setIsGold(debt.isGold)
      setGoldKarat(debt.goldKarat || 24)
      setNotes(debt.notes || '')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, debt])

  const handleSave = () => {
    if (!debt || !name || !person) return

    updateDebt(debt.id, {
      name,
      person,
      description: description || undefined,
      currency: isGold ? 'XAU' : clampDebtFiatToAllowed(settings, currency),
      isGold,
      goldKarat: isGold ? goldKarat : undefined,
      notes: notes || undefined,
    })

    handleClose()
  }

  const handleDelete = () => {
    if (!debt) return
    if (window.confirm(`Delete "${debt.name}" and all its payments? This cannot be undone.`)) {
      deleteDebt(debt.id)
      handleClose()
    }
  }

  const handleClose = () => {
    setEditingDebtId(null)
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  if (!debt) return null

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
            <div className="p-6">
              <div className="w-10 h-1 bg-[var(--color-brand-border)] rounded-full mx-auto mb-4 lg:hidden" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Edit Debt</h3>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Debt Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
                  />
                </div>

                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Person</Label>
                  <Input
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
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

                {!isGold && (
                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
                    <DebtFiatCurrencySelect
                      value={currency}
                      onChange={setCurrency}
                      className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                    />
                  </div>
                )}

                {isGold && (
                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Karat</Label>
                    <select
                      value={goldKarat}
                      onChange={(e) => setGoldKarat(parseInt(e.target.value) as GoldKarat)}
                      className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                    >
                      <option value="24">24K (99.9%)</option>
                      <option value="22">22K (91.7%)</option>
                      <option value="21">21K (87.5%)</option>
                      <option value="18">18K (75%)</option>
                    </select>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]"
                  />
                </div>

                <p className="text-xs text-[var(--color-brand-text-muted)]">
                  Starting balance ({debt.isGold ? `${debt.startingBalance}g` : `${debt.currency} ${debt.startingBalance}`}) cannot be changed — delete and recreate the debt if needed.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleDelete}
                    className="py-3 px-4 rounded-xl border border-red-900/50 text-sm text-[var(--color-brand-red)] hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!name || !person}
                    className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
    </ModalShell>
  )
}
