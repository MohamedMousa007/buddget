'use client'

import { pickablePaymentMethods } from '@/lib/accounts/kinds'
import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PaymentMethod } from '@/lib/store/types'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { defaultColorForPaymentMethodType, decomposePaymentMethodName, methodDisplayName } from '@/lib/payment/paymentMethodDefaults'
import { accountIdentifier, cardKindLabel } from '@/components/features/accounts/accountDisplay'
import { CardFaceChip } from '@/components/features/accounts/CardFaceChip'
import { rgba } from '@/lib/utils/color'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useT } from '@/lib/i18n'
import { SelectPaymentMethodSheet } from '@/components/features/payments/SelectPaymentMethodSheet'
import { FieldButton } from '@/components/ui/FieldButton'

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
  /** `card`: the selected method as its mini card with a two-line name (the expense sheet's Paid with). Default unchanged. */
  variant?: 'default' | 'card'
}

/**
 * Shared payment-method trigger + card-carousel picker. Manages its own open
 * state; the picker sheet handles adding a new method inline (setup sheet). Used
 * by the expense sheet and the income add/edit modals.
 */
export function PaymentMethodPicker({
  value,
  onChange,
  paymentMethods: allMethods,
  label,
  variant = 'default',
}: PaymentMethodPickerProps) {
  const t = useT()
  const paymentMethods = useMemo(() => pickablePaymentMethods(allMethods, value), [allMethods, value])
  const [open, setOpen] = useState(false)

  const selPay = paymentMethods.find((m) => m.id === value) || paymentMethods[0]
  const parentOf = (m: PaymentMethod) => (m.parentId ? allMethods.find((p) => p.id === m.parentId) : undefined)

  return (
    <div>
      {label ? <div className={`${microClassName} mb-2.5`}>{label}</div> : null}
      {variant === 'card' && selPay ? (
        <FieldButton
          onClick={() => setOpen(true)}
          className="h-auto min-h-[72px] rounded-[14px] bg-[var(--color-brand-elevated)] py-2 ps-2 pe-3"
          affordance={<ChevronDown className="w-5 h-5 shrink-0 text-[var(--color-brand-text-muted)]" />}
          value={
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <CardFaceChip method={selPay} parent={parentOf(selPay)} />
              <span className="min-w-0 flex-1 text-start">
                <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">
                  {decomposePaymentMethodName(methodDisplayName(parentOf(selPay) ?? selPay, t.accountsPage.typeCash), (parentOf(selPay) ?? selPay).last4 ?? undefined).provider}
                </span>
                <span className="mt-0.5 block truncate text-xs font-medium text-[var(--color-brand-text-muted)]">
                  {[cardKindLabel(selPay.type, t.accountsPage), selPay.currency, accountIdentifier(selPay)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </span>
          }
        />
      ) : (
      <FieldButton
        onClick={() => setOpen(true)}
        className="bg-[var(--color-brand-elevated)] px-3"
        affordance={<ChevronDown className="w-5 h-5 shrink-0 text-[var(--color-brand-text-muted)]" />}
        value={
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
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
                {decomposePaymentMethodName(methodDisplayName(selPay, t.accountsPage.typeCash), selPay.last4 ?? undefined).provider}
              </span>
              <span className="shrink-0 text-xs font-medium text-[var(--color-brand-text-muted)]">
                {selPay.currency}
                {accountIdentifier(selPay) ? ` · ${accountIdentifier(selPay)}` : ''}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-[var(--color-brand-text-muted)]">
              {t.expenseForm.addPaymentMethod}
            </span>
          )}
          </span>
        }
      />
      )}

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
