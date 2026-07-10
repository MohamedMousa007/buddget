'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PaymentMethod } from '@/lib/store/types'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { defaultColorForPaymentMethodType } from '@/lib/payment/paymentMethodDefaults'
import { rgba } from '@/lib/utils/color'
import { useT } from '@/lib/i18n'
import { SelectPaymentMethodSheet } from '@/components/features/payments/SelectPaymentMethodSheet'

function swatchColor(pm: PaymentMethod): string {
  return pm.color || defaultColorForPaymentMethodType(pm.type)
}

export interface PaymentMethodPickerProps {
  /** Selected payment method id. */
  value: string
  onChange: (id: string) => void
  paymentMethods: PaymentMethod[]
  /** Optional uppercase micro-label above the trigger. */
  label?: string
}

/**
 * Shared payment-method trigger + card-carousel picker. Manages its own open
 * state; the picker sheet handles adding a new method inline (setup sheet). Used
 * by the expense sheet and the income add/edit modals.
 */
export function PaymentMethodPicker({
  value,
  onChange,
  paymentMethods,
  label,
}: PaymentMethodPickerProps) {
  const t = useT()
  const [open, setOpen] = useState(false)

  const selPay = paymentMethods.find((m) => m.id === value) || paymentMethods[0]
  const microLabel = 'font-semibold text-[10px] tracking-[.08em] uppercase text-[var(--color-brand-text-muted)]'

  return (
    <div>
      {label ? <div className={`${microLabel} mb-2.5`}>{label}</div> : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 hover:border-[var(--color-brand-text-muted)]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {selPay ? (
            <>
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: rgba(swatchColor(selPay), 0.16), color: swatchColor(selPay) }}
              >
                {(() => {
                  const Icon = paymentTypeIcon(selPay.type)
                  return <Icon className="w-[15px] h-[15px]" />
                })()}
              </span>
              <span className="min-w-0 truncate text-start text-sm font-semibold text-[var(--color-brand-text-primary)]">
                {selPay.name}
              </span>
              <span className="shrink-0 text-xs font-medium text-[var(--color-brand-text-muted)]">
                {selPay.currency}
                {selPay.last4 ? ` · ··${selPay.last4}` : ''}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-[var(--color-brand-text-muted)]">
              {t.expenseForm.addPaymentMethod}
            </span>
          )}
        </div>
        <ChevronDown className="w-5 h-5 shrink-0 text-[var(--color-brand-text-muted)]" />
      </button>

      <SelectPaymentMethodSheet
        open={open}
        value={value}
        paymentMethods={paymentMethods}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}
