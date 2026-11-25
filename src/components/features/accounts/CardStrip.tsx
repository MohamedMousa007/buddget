import { Plus } from 'lucide-react'
import type { PaymentMethod } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { CardFaceChip } from './CardFaceChip'

interface CardStripProps {
  cards: PaymentMethod[]
  onOpen: () => void
  onAddCard: () => void
  /** The account the cards hang under; its bank names them. */
  parent?: PaymentMethod
  /** Replaces the "N cards" label (a prepaid account drawn as its own face reads "Prepaid"). */
  label?: string
}

/** Up to two 88×56 card faces side by side, "+N" for more, a dashed add slot when there are none. Always LTR. */
export function CardStrip({ cards, onOpen, onAddCard, parent, label }: CardStripProps) {
  const t = useT().accountsPage
  if (cards.length === 0) {
    return (
      <button type="button" onClick={onAddCard} dir="ltr" data-raw-button-ok="a whole-strip tap target under the account row" className="flex min-h-11 w-full items-center gap-2.5 px-4 pb-3 ps-[76px] text-start">
        <span className="flex h-14 w-[88px] items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] text-[var(--color-brand-primary-ink)]">
          <Plus className="size-4" aria-hidden />
        </span>
        <span className="text-[0.78125rem] font-semibold text-[var(--color-brand-primary-ink)]">{t.addACard}</span>
      </button>
    )
  }
  const shown = cards.slice(0, 2)
  const more = cards.length - shown.length
  return (
    <button type="button" onClick={onOpen} dir="ltr" data-raw-button-ok="a whole-strip tap target under the account row" aria-label={label ?? t.cardsCount(cards.length)} className="flex min-h-11 w-full items-center gap-2 px-4 pb-3 ps-[76px] text-start">
      {shown.map((c) => <CardFaceChip key={c.id} method={c} parent={parent} />)}
      {more > 0 ? <span className="flex h-14 w-11 items-center justify-center rounded-[7px] bg-[var(--color-brand-elevated)] font-mono-numbers text-xs font-bold text-[var(--color-brand-text-secondary)]">+{more}</span> : null}
      <span className="ms-auto whitespace-nowrap text-xs font-semibold text-[var(--color-brand-text-muted)]">{label ?? t.cardsCount(cards.length)}</span>
    </button>
  )
}
