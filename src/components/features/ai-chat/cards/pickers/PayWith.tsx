'use client'

import { useState } from 'react'
import { Coins, Plus } from 'lucide-react'
import { CardFaceChip } from '@/components/features/accounts/CardFaceChip'
import { SelectPaymentMethodSheet } from '@/components/features/payments/SelectPaymentMethodSheet'
import { pickablePaymentMethods } from '@/lib/accounts/kinds'
import { refOf } from '@/lib/buddgy/tools/refs'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { bankAbbreviation, cardBankName } from '@/lib/payment/cardThemes'
import type { PaymentMethod } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cn } from '@/lib/utils'

/** Tiles past this many go behind "Other", so the strip stays a glance and not a list. */
const STRIP_MAX = 6

export interface PayWithProps {
  /** The ref of the method the card will use: ringed as the best guess. */
  value: string
  onPick: (ref: string) => void
  label?: string
  /** The person never named it: say it is needed and that the ring is a guess. */
  missing?: boolean
}

/** Which mini card the strip shows for a method: Cash is a tile of its own, everything else is its card face. */
const isCash = (m: PaymentMethod) => m.type === 'cash'

/**
 * "Paid with?" as a strip of the app's mini cards plus Cash. The best guess is ringed; "Other" opens the
 * payment method sheet the expense form uses. Picking sends the method's ref back to revise the proposal.
 */
export function PayWith({ value, onPick, label, missing = false }: PayWithProps) {
  const copy = useBuddgyCardCopy().payWith
  const all = useFinanceStore((s) => s.paymentMethods)
  const [sheet, setSheet] = useState(false)
  const pickable = pickablePaymentMethods(all)
  const byId = new Map(all.map((m) => [m.id, m]))
  const chosen = pickable.find((m) => refOf(m.id) === value)
  // The ringed one always shows, even when it would fall past the cap.
  const strip = pickable.slice(0, STRIP_MAX)
  if (chosen && !strip.includes(chosen)) strip[strip.length - 1] = chosen

  return (
    <div role="group" aria-label={label ?? copy.label} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8125rem] font-semibold">{label ?? copy.label}</span>
        {missing ? <span className="text-xs font-semibold text-[var(--color-brand-amber)]">{copy.needed}</span> : null}
      </div>
      <div dir="ltr" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 pt-0.5">
        {strip.map((m) => {
          const on = refOf(m.id) === value
          const parent = m.parentId ? byId.get(m.parentId) : null
          const caption = isCash(m) ? copy.cash : bankAbbreviation(cardBankName(m, parent)) || m.name
          return (
            <button
              key={m.id}
              type="button"
              data-raw-button-ok="a mini-card tile in the pay-with strip, ringed when chosen"
              aria-pressed={on}
              aria-label={m.last4 ? copy.ending(m.name, m.last4) : m.name}
              onClick={() => onPick(refOf(m.id))}
              className={cn(
                'flex min-h-[84px] min-w-[96px] flex-none flex-col items-center gap-1.5 rounded-[13px] border-2 px-0.5 pb-1.5 pt-1 outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]',
                on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]' : 'border-transparent',
              )}
            >
              {isCash(m) ? (
                <span className="flex h-14 w-[88px] items-center justify-center gap-1.5 rounded-[7px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[0.6875rem] font-bold text-[var(--color-brand-gold)]">
                  <Coins className="size-4" aria-hidden />
                  {copy.cash}
                </span>
              ) : (
                <CardFaceChip method={m} parent={parent} />
              )}
              <span className={cn('max-w-[88px] truncate text-[0.6875rem] font-semibold leading-tight', on ? 'text-[var(--color-brand-primary-ink)]' : 'text-[var(--color-brand-text-secondary)]')}>
                {caption}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          data-raw-button-ok="the Other tile at the end of the pay-with strip, opens the method sheet"
          aria-label={copy.otherAria}
          aria-haspopup="dialog"
          onClick={() => setSheet(true)}
          className="flex min-h-[84px] min-w-[96px] flex-none flex-col items-center gap-1.5 rounded-[13px] border-2 border-transparent px-0.5 pb-1.5 pt-1 outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]"
        >
          <span className="flex h-14 w-[88px] items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] text-[var(--color-brand-primary-ink)]">
            <Plus className="size-4" aria-hidden />
          </span>
          <span className="text-[0.6875rem] font-semibold leading-tight text-[var(--color-brand-primary-ink)]">{copy.other}</span>
        </button>
      </div>
      {missing ? <span className="text-xs text-[var(--color-brand-text-muted)]">{copy.guess}</span> : null}
      {sheet ? (
        <SelectPaymentMethodSheet
          open
          value={chosen?.id ?? ''}
          paymentMethods={all}
          onSelect={(id) => onPick(refOf(id))}
          onClose={() => setSheet(false)}
        />
      ) : null}
    </div>
  )
}
