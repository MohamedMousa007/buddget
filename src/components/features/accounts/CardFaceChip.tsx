import { cardGradient } from '@/components/features/payments/PaymentCardCarousel'
import { cardFace } from '@/lib/ui/contrast'
import type { PaymentMethod } from '@/lib/store/types'
import { accountColor, cardNetwork, cardTypeLabel } from './accountDisplay'

/**
 * The small sibling of the carousel's card face: provider, type and last 4 on a 70×44 card.
 * Same gradient helper as the large face, so a card looks the same everywhere.
 */
export function CardFaceChip({ method }: { method: PaymentMethod }) {
  const color = accountColor(method)
  return (
    <span
      className="flex h-11 w-[70px] shrink-0 flex-col justify-between rounded-[9px] px-[7px] py-1.5 shadow-[var(--shadow-sm)]"
      style={{ color: cardFace(color).ink, background: cardGradient(color) }}
    >
      <span className="truncate text-[0.5625rem] font-extrabold leading-none tracking-[0.04em]">{cardNetwork(method)}</span>
      <span className="flex items-end justify-between text-[0.5rem] font-semibold leading-none">
        <span>{cardTypeLabel(method)}</span>
        {method.last4 ? <span className="font-mono-numbers">{method.last4}</span> : null}
      </span>
    </span>
  )
}
