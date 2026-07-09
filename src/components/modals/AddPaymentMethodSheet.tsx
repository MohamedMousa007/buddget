'use client'

import { useState, useEffect, useRef } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { PmPrefill } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Switch } from '@/components/ui/switch'
import { PAYMENT_METHOD_TYPE_OPTIONS } from '@/lib/constants/finance'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import {
  defaultColorForPaymentMethodType,
  defaultIconEmojiForPaymentMethodType,
} from '@/lib/payment/paymentMethodDefaults'
import type { Currency, PaymentMethodType } from '@/lib/store/types'
import {
  MODAL_BODY_SCROLL_CLASS,
  MODAL_CONTROL_CLASS,
  MODAL_LABEL_CLASS,
} from '@/lib/modals/modalFormClasses'

const ADD_PAYMENT_METHOD_TYPES = ['cash', 'bank_transfer', 'nol', 'card_credit', 'card_debit'] as const satisfies readonly PaymentMethodType[]

const LAST4_TYPES: PaymentMethodType[] = ['bank_transfer', 'card_credit', 'card_debit']

export function AddPaymentMethodSheet() {
  const { addPaymentMethod, settings } = useFinanceStore()
  const { activeModal, setActiveModal, pmPrefill, clearPmPrefill } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addPaymentMethod'

  const [name, setName] = useState('')
  const [type, setType] = useState<PaymentMethodType>('cash')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [isDefault, setIsDefault] = useState(false)
  const [last4, setLast4] = useState('')
  const [last4Error, setLast4Error] = useState<string | null>(null)
  const prevIsOpen = useRef(false)
  const appliedPrefill = useRef<PmPrefill | null>(null)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency and prefill when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setCurrency(settings.baseCurrency)
      if (pmPrefill && appliedPrefill.current !== pmPrefill) {
        appliedPrefill.current = pmPrefill
        setName(pmPrefill.name)
        setLast4(pmPrefill.last4)
        setType('bank_transfer')
      }
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, pmPrefill])

  const resetForm = () => {
    setName('')
    setType('cash')
    setCurrency(settings.baseCurrency)
    setIsDefault(false)
    setLast4('')
    setLast4Error(null)
    appliedPrefill.current = null
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    if (last4 && LAST4_TYPES.includes(type)) {
      if (!/^\d{4}$/.test(last4)) {
        setLast4Error('Must be exactly 4 digits')
        return
      }
    }

    addPaymentMethod({
      name: name.trim(),
      type,
      currency: clampFiatToAllowed(settings, currency),
      color: defaultColorForPaymentMethodType(type, name.trim()),
      icon: defaultIconEmojiForPaymentMethodType(type),
      isDefault,
      ...(last4 && LAST4_TYPES.includes(type) ? { last4 } : {}),
    })

    resetForm()
    clearPmPrefill()
    setActiveModal(null)
  }

  const handleClose = () => {
    resetForm()
    clearPmPrefill()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        <div className="shrink-0 px-5 pt-1">
          <ModalSheetHeader title={t.modals.addPaymentTitle} onClose={handleClose} />
        </div>
        <div className={`${MODAL_BODY_SCROLL_CLASS} px-5`}>
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
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        type === opt ?
                          'bg-[var(--color-brand-red)] text-white'
                        : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] border border-[var(--color-brand-border)] hover:border-[var(--color-brand-text-muted)]'
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
              className={`mt-1.5 w-full h-12 px-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] text-sm focus:border-[var(--color-brand-red)]`}
            />
          </div>

          {LAST4_TYPES.includes(type) && (
            <div>
              <label htmlFor="pm-last4" className={MODAL_LABEL_CLASS}>
                Last 4 digits
              </label>
              <AmountField
                id="pm-last4"
                mode="pin"
                label="Card last 4 digits"
                placeholder="e.g. 0001"
                value={last4}
                onChange={(v) => {
                  setLast4(v.replace(/\D/g, '').slice(0, 4))
                  setLast4Error(null)
                }}
                className={`mt-1.5 ${MODAL_CONTROL_CLASS}${last4Error ? ' border-red-500' : ''}`}
              />
              {last4Error && (
                <p className="mt-1 text-xs text-red-400">{last4Error}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 py-1">
            <span className={MODAL_LABEL_CLASS}>{t.modals.addPaymentLabelDefault}</span>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>
        <div className="shrink-0 px-5 pb-5 pt-4">
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
