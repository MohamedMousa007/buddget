'use client'

import { useState, useEffect, useRef } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PAYMENT_METHOD_TYPE_OPTIONS } from '@/lib/constants/finance'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import type { Currency, PaymentMethodType } from '@/lib/store/types'

const COLORS = ['#C0C0C0', '#F5C842', '#1DB954', '#E50914', '#3B82F6', '#A855F7', '#EC4899', '#FFFFFF']

export function AddPaymentMethodSheet() {
  const { addPaymentMethod, settings } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addPaymentMethod'

  const [name, setName] = useState('')
  const [type, setType] = useState<PaymentMethodType>('cash')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [color, setColor] = useState('#C0C0C0')
  const [isDefault, setIsDefault] = useState(false)
  const prevIsOpen = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setCurrency(settings.baseCurrency)
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency])

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
      currency: clampFiatToAllowed(settings, currency),
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
              <ModalSheetHeader title={t.modals.addPaymentTitle} onClose={handleClose} />

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.modals.addPaymentLabelName}</Label>
                  <Input
                    placeholder={t.modals.addPaymentPlaceholderName}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
                  />
                </div>

                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">{t.modals.addPaymentLabelType}</Label>
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
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.modals.addPaymentLabelCurrency}</Label>
                  <FiatCurrencySelect
                    value={currency}
                    onChange={setCurrency}
                    className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">{t.modals.addPaymentLabelColor}</Label>
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
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.modals.addPaymentLabelDefault}</Label>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                  >
                    {t.common.neverMind}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!name}
                    className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {t.modals.addPaymentSubmit}
                  </button>
                </div>
              </div>
            </div>
    </ModalShell>
  )
}
