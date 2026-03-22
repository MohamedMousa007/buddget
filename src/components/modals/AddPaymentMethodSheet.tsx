'use client'

import { useState } from 'react'
import { useEscapeClose } from '@/lib/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { X } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FIAT_CURRENCIES, PAYMENT_METHOD_TYPE_OPTIONS } from '@/lib/constants/finance'
import type { Currency, PaymentMethodType } from '@/lib/store/types'

const COLORS = ['#C0C0C0', '#F5C842', '#1DB954', '#E50914', '#3B82F6', '#A855F7', '#EC4899', '#FFFFFF']

export function AddPaymentMethodSheet() {
  const { addPaymentMethod, settings } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const isOpen = activeModal === 'addPaymentMethod'

  const [name, setName] = useState('')
  const [type, setType] = useState<PaymentMethodType>('cash')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [color, setColor] = useState('#C0C0C0')
  const [isDefault, setIsDefault] = useState(false)

  const resetForm = () => {
    setName('')
    setType('cash')
    setCurrency(settings.baseCurrency)
    setColor('#C0C0C0')
    setIsDefault(false)
  }

  const handleSubmit = () => {
    if (!name) return

    addPaymentMethod({
      name,
      type,
      currency,
      color,
      isDefault,
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
                <h3 className="text-lg font-semibold text-white">Add Payment Method</h3>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Name</Label>
                  <Input
                    placeholder="e.g. Silver Nol, ADCB Debit"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
                  />
                </div>

                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHOD_TYPE_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setType(t.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          type === t.value
                            ? 'bg-[var(--color-brand-red)] text-white'
                            : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
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

                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">Color</Label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          color === c ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Set as default?</Label>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
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
                    disabled={!name}
                    className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    Add Method →
                  </button>
                </div>
              </div>
            </div>
    </ModalShell>
  )
}
