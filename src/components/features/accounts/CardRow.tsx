import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CardDetails } from '@/lib/accounts/cardDetails'
import { MASK } from '@/lib/privacy/mask'
import type { PaymentMethod } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { CardFaceChip } from './CardFaceChip'
import { accountDisplayName, accountTitle, cardKindLabel, moneyFlex } from './accountDisplay'

interface CardRowProps {
  method: PaymentMethod
  /** The account the card hangs under; names the bank on the face and in the title. */
  parent?: PaymentMethod
  details: CardDetails | null
  masked: boolean
  onOpen: () => void
}

/**
 * One card as a list row: its mini face, "CIB Credit", and one fact line. A credit card shows what is owed (amber) and
 * its limit, and nothing owed when it is zero; pay-later points to Debts; any other card its label and currency.
 */
export function CardRow({ method, parent, details, masked, onOpen }: CardRowProps) {
  const dict = useT()
  const t = dict.accountsPage
  const dueDayLabel = useAccountsLtCopy().addCard.dueDay
  const kind = cardKindLabel(method.type, t)
  const bank = accountTitle(parent ?? method)
  const fmt = (n: number, cur: string) => (masked ? MASK : `${moneyFlex(n, cur)} ${cur}`)
  let sub: ReactNode
  if (details?.kind === 'credit') {
    const owed = details.outstanding ?? 0
    const limit = details.limit != null ? `${t.cardLimit} ${fmt(details.limit, details.currency)}` : null
    const due = details.dueDay != null ? `${dueDayLabel} ${details.dueDay}` : null
    const rest = [limit, due].filter(Boolean).join(' · ')
    sub = owed > 0
      ? <>{t.owed} <b className="font-mono-numbers font-semibold text-[var(--color-brand-amber)]">{fmt(owed, details.currency)}</b>{rest ? ` · ${rest}` : ''}</>
      : rest || kind
  } else if (method.type === 'bnpl') {
    sub = [kind, details?.kind === 'bnpl' ? `${details.paid}/${details.count}` : null, t.planInDebts].filter(Boolean).join(' · ')
  } else {
    sub = [kind, String(method.currency)].filter(Boolean).join(' · ')
  }
  // The card's own Name, else the account's Name (or provider) with the kind, as the card sheet titles it.
  const title = method.label?.trim() || (parent ? `${accountDisplayName(parent)} ${kind}` : bank)
  return (
    <button type="button" onClick={onOpen} data-raw-button-ok="a whole-row tap target, sized by its content"
      aria-label={[bank, kind, method.last4].filter(Boolean).join(' ')}
      className="flex min-h-[76px] w-full items-center gap-3 py-2.5 pe-3.5 ps-3 text-start">
      <CardFaceChip method={method} parent={parent} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
          {method.isDefault ? <Badge variant="muted" size="xs">{dict.paymentMethods.default}</Badge> : null}
        </span>
        <span dir="auto" className="mt-0.5 block truncate text-[0.8125rem] text-[var(--color-brand-text-muted)]">{sub}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
    </button>
  )
}
