import type { PaymentMethod } from '@/lib/store/types'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { accountColor, accountDisplayName, accountTitle } from '@/components/features/accounts/accountDisplay'
import { bankLogoForName } from '@/lib/payment/bankLogos'

/** A payment method as a picker row's value (Paid with, Received in): its bank's logo, its name and the last four digits. */
export function MethodValue({ method }: { method: PaymentMethod }) {
  return (
    <>
      <BrandMark name={accountTitle(method)} color={accountColor(method)} size={24} logo={bankLogoForName(accountTitle(method))} />
      <span dir="auto" className="truncate">{accountDisplayName(method)}</span>
      {method.last4 ? <span dir="ltr" className="shrink-0 font-mono-numbers text-[var(--color-brand-text-muted)]">••{method.last4}</span> : null}
    </>
  )
}
