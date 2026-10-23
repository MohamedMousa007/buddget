import { cardGradient } from '@/components/features/payments/PaymentCardCarousel'
import type { PaymentMethod } from '@/lib/store/types'
import { accountColor, cardNetwork, cardTypeLabel } from './accountDisplay'

/**
 * The small sibling of the carousel's card face: provider, type and last 4 on a 70×44 card.
 * Same gradient helper as the large face, so a card looks the same everywhere.
 */
export function CardFaceChip({ method }: { method: PaymentMethod }) {
  return (
    <span
      className="flex h-11 w-[70px] shrink-0 flex-col justify-between rounded-[9px] px-[7px] py-1.5 text-white shadow-[var(--shadow-sm)]"
      style={{ background: cardGradient(accountColor(method)) }}
    >
      <span className="truncate text-[9px] font-extrabold leading-none tracking-[0.04em]">{cardNetwork(method)}</span>
      <span className="flex items-end justify-between text-[8px] font-semibold leading-none opacity-90">
        <span>{cardTypeLabel(method)}</span>
        {method.last4 ? <span className="font-mono-numbers">{method.last4}</span> : null}
      </span>
    </span>
  )
}
