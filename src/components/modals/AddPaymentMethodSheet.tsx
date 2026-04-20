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
import { useDraftEntry } from '@/lib/onboarding/draftEntry'
import type { Currency, PaymentMethodType } from '@/lib/store/types'

interface PaymentMethodDraftShape {
  name: string
  type: PaymentMethodType
  currency: Currency
  color: string
  isDefault: boolean
}

const COLORS = ['#C0C0C0', '#F5C842', '#1DB954', '#E50914', '#3B82F6', '#A855F7', '#EC4899', '#FFFFFF']

export function AddPaymentMethodSheet() {
  const { addPaymentMethod, settings } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addPaymentMethod'

  // Journey-mode draft resume: no-op when the PM modal is opened from
  // regular app routes. On first mount inside /onboarding, seed from
  // any half-filled draft so a mid-modal tab close doesn't lose work.
  const draft = useDraftEntry<PaymentMethodDraftShape>('paymentMethods')

  const [name, setName] = useState(draft.initial?.name ?? '')
  const [type, setType] = useState<PaymentMethodType>(draft.initial?.type ?? 'cash')
  const [currency, setCurrency] = useState<Currency>(
    draft.initial?.currency ?? settings.baseCurrency,
  )
  const [color, setColor] = useState(draft.initial?.color ?? '#C0C0C0')
  const [isDefault, setIsDefault] = useState(draft.initial?.isDefault ?? false)
  const prevIsOpen = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      // Don't clobber a resumed draft currency when the user re-opens
      // the modal mid-journey.
      if (!draft.active || !draft.initial?.currency) {
        setCurrency(settings.baseCurrency)
      }
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, draft.active, draft.initial])

  // Keep the persisted draft in sync with live form edits (debounced).
  useEffect(() => {
    if (!isOpen || !draft.active) return
    draft.update({ name, type, currency, color, isDefault })
  }, [isOpen, draft, name, type, currency, color, isDefault])

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

    draft.clear()
    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    // Don't reset or clear the draft on plain close — the user may be
    // stepping away mid-edit. The draft persists until save or next
    // successful completion. Fresh `?isDefault=false` etc. will be
    // restored from the draft on re-open.
    if (!draft.active) resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
            <div className="p-5">
              <ModalSheetHeader title={t.modals.addPaymentTitle} onClose={handleClose} />

              <div className="space-y-4">
                <div data-tutorial-id="pm-modal:name">
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.modals.addPaymentLabelName}</Label>
                  <Input
                    placeholder={t.modals.addPaymentPlaceholderName}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
                  />
                </div>

                <div data-tutorial-id="pm-modal:type">
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

                <div data-tutorial-id="pm-modal:currency">
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.modals.addPaymentLabelCurrency}</Label>
                  <FiatCurrencySelect
                    value={currency}
                    onChange={setCurrency}
                    className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
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
                    data-tutorial-id="pm-modal:save"
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
