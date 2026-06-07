'use client'

import { useState, useEffect, useRef } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { PAYMENT_METHOD_TYPE_OPTIONS } from '@/lib/constants/finance'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { useDraftEntry } from '@/lib/onboarding/draftEntry'
import {
  defaultColorForPaymentMethodType,
  defaultIconEmojiForPaymentMethodType,
} from '@/lib/payment/paymentMethodDefaults'
import type { Currency, PaymentMethodType } from '@/lib/store/types'
import {
  MODAL_BODY_SCROLL_CLASS,
  MODAL_CONTROL_CLASS,
  MODAL_LABEL_CLASS,
  MODAL_SHEET_OUTER_CLASS,
} from '@/lib/modals/modalFormClasses'

const ADD_PAYMENT_METHOD_TYPES = ['cash', 'bank_transfer', 'nol', 'card_credit', 'card_debit'] as const satisfies readonly PaymentMethodType[]

interface PaymentMethodDraftShape {
  name: string
  type: PaymentMethodType
  currency: Currency
  isDefault: boolean
}

export function AddPaymentMethodSheet() {
  const { addPaymentMethod, settings } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addPaymentMethod'

  const draft = useDraftEntry<PaymentMethodDraftShape>('paymentMethods')

  const [name, setName] = useState(draft.initial?.name ?? '')
  const [type, setType] = useState<PaymentMethodType>(draft.initial?.type ?? 'cash')
  const [currency, setCurrency] = useState<Currency>(
    draft.initial?.currency ?? settings.baseCurrency,
  )
  const [isDefault, setIsDefault] = useState(draft.initial?.isDefault ?? false)
  const prevIsOpen = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      if (!draft.active || !draft.initial?.currency) {
        setCurrency(settings.baseCurrency)
      }
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, draft.active, draft.initial])

  useEffect(() => {
    if (!isOpen || !draft.active) return
    draft.update({ name, type, currency, isDefault })
  }, [isOpen, draft, name, type, currency, isDefault])

  const resetForm = () => {
    setName('')
    setType('cash')
    setCurrency(settings.baseCurrency)
    setIsDefault(false)
  }

  const handleSubmit = () => {
    if (!name.trim()) return

    addPaymentMethod({
      name: name.trim(),
      type,
      currency: clampFiatToAllowed(settings, currency),
      color: defaultColorForPaymentMethodType(type, name.trim()),
      icon: defaultIconEmojiForPaymentMethodType(type),
      isDefault,
    })

    draft.clear()
    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    if (!draft.active) resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
      <div className={`${MODAL_SHEET_OUTER_CLASS} p-5`}>
        <div className="shrink-0">
          <ModalSheetHeader title={t.modals.addPaymentTitle} onClose={handleClose} />
        </div>
        <div className={MODAL_BODY_SCROLL_CLASS}>
          <div>
            <label htmlFor="pm-name" className={MODAL_LABEL_CLASS}>
              {t.modals.addPaymentLabelName}
            </label>
            <Input
              id="pm-name"
              placeholder={t.modals.addPaymentPlaceholderName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
            />
          </div>

          <div>
            <span className={MODAL_LABEL_CLASS}>{t.modals.addPaymentLabelType}</span>
            <div className="-mx-1 mt-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-1.5 px-1">
                {ADD_PAYMENT_METHOD_TYPES.map((opt) => {
                  const label = PAYMENT_METHOD_TYPE_OPTIONS.find((o) => o.value === opt)?.label ?? opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setType(opt)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        type === opt ?
                          'bg-[var(--color-brand-red)] text-white'
                        : 'bg-[#1A1A24] text-[#A0A0B8] border border-[#2A2A38] hover:border-[#5A5A72]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div>
            <span className={MODAL_LABEL_CLASS}>{t.modals.addPaymentLabelCurrency}</span>
            <FiatCurrencySelect
              value={currency}
              onChange={setCurrency}
              className={`mt-1.5 w-full h-12 px-3 rounded-xl border border-[#2A2A38] bg-[#1A1A24] text-white text-sm focus:border-[#E50914]`}
            />
          </div>

          <div className="flex items-center justify-between gap-3 py-1">
            <span className={MODAL_LABEL_CLASS}>{t.modals.addPaymentLabelDefault}</span>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>
        <div className="shrink-0 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full py-3.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {t.modals.addPaymentSubmit}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
