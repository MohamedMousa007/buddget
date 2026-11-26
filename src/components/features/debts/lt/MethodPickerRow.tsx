'use client'

import { useState } from 'react'
import { PickerRow } from '@/components/ui/PickerRow'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { accountColor, accountTitle } from '@/components/features/accounts/accountDisplay'
import { SelectPaymentMethodSheet } from '@/components/features/payments/SelectPaymentMethodSheet'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import type { PaymentMethod } from '@/lib/store/types'

/** The logo, name and ••last4 a row shows for a payment method. */
export function MethodValue({ method }: { method: PaymentMethod }) {
  const title = accountTitle(method)
  return (
    <>
      <BrandMark name={title} color={accountColor(method)} size={24} logo={bankLogoForName(title)} />
      <span dir="auto" className="truncate">{title}</span>
      {method.last4 ? <span dir="ltr" className="shrink-0 font-mono-numbers text-[var(--color-brand-text-muted)]">••{method.last4}</span> : null}
    </>
  )
}

/** A sheet row ("Paid with", "Received in") that shows the chosen payment method and opens the payment-method sheet. */
export function MethodPickerRow({ label, value, onChange, paymentMethods }: {
  label: string
  value: string
  onChange: (id: string) => void
  paymentMethods: PaymentMethod[]
}) {
  const c = useDebtsSubsLtCopy().method
  const [open, setOpen] = useState(false)
  const method = paymentMethods.find((m) => m.id === value)
  return (
    <>
      <PickerRow
        label={label}
        onClick={() => setOpen(true)}
        aria-label={method ? `${label}: ${accountTitle(method)}` : label}
        value={method ? <MethodValue method={method} /> : <span className="text-[var(--color-brand-text-muted)]">{c.choose}</span>}
      />
      <SelectPaymentMethodSheet open={open} value={value} paymentMethods={paymentMethods} onSelect={onChange} onClose={() => setOpen(false)} />
    </>
  )
}
