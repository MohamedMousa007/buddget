import { cardGradient } from '@/components/features/payments/PaymentCardCarousel'
import { cardFace } from '@/lib/ui/contrast'
import type { PaymentMethod } from '@/lib/store/types'
import { accountColor, cardNetworkIfKnown, cardTypeLabel } from './accountDisplay'

/**
 * The small sibling of the carousel's card face: the card type and its last four digits on a 70×44 card, no bank name
 * (the account row above already says whose it is). The network (VISA, MEEZA) shows only when the name states one.
 * Same gradient helper as the large face, so a card looks the same everywhere.
 */
export function CardFaceChip({ method }: { method: PaymentMethod }) {
  const color = accountColor(method)
  const network = cardNetworkIfKnown(method)
  return (
    <span
      className="flex h-11 w-[70px] shrink-0 flex-col justify-between rounded-[9px] px-[7px] py-1.5 shadow-[var(--shadow-sm)]"
      style={{ color: cardFace(color).ink, background: cardGradient(color) }}
    >
      <span className="flex items-start justify-between gap-1 leading-none">
        <span className="text-[0.5625rem] font-bold tracking-[0.02em]">{cardTypeLabel(method)}</span>
        {network ? <span className="truncate text-[0.4375rem] font-extrabold tracking-[0.04em] opacity-80">{network}</span> : null}
      </span>
      <span className="font-mono-numbers text-[0.6875rem] font-semibold leading-none tracking-[0.08em]">
        {method.last4 ? `••${method.last4}` : '••••'}
      </span>
    </span>
  )
}
