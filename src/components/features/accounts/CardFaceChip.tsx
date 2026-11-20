import type { PaymentMethod } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { CHIP_FILL, bankAbbreviation, cardBankName, cardLook } from '@/lib/payment/cardThemes'
import { faceLook } from '@/components/features/payments/CardFace'
import { cardKindLabel } from './accountDisplay'

/**
 * The 88×56 mini card (radius 7) of the approved design: the bank's short name on the left, the card type on the
 * right, a chip and the last four digits below. Same theme and finish as the large face, so a card looks the same
 * everywhere. `parent` names the bank for a card that hangs under an account.
 */
export function CardFaceChip({ method, parent, selected = false }: { method: PaymentMethod; parent?: PaymentMethod | null; selected?: boolean }) {
  const t = useT().accountsPage
  const { style, theme } = cardLook(method)
  const f = faceLook(theme, style, { light: 0.045, dark: 0.18 })
  const bank = bankAbbreviation(cardBankName(method, parent))
  const kind = cardKindLabel(method.type, t)
  const engrave = f.metal ? (f.lightInk ? '0 1px 0 rgba(0,0,0,.55)' : '0 1px 0 rgba(255,255,255,.45)') : (f.lightInk ? '0 1px 0 rgba(0,0,0,.35)' : 'none')
  const line = f.lightInk ? 'rgba(255,255,255,.12)' : 'rgba(4,32,28,.12)'
  const chip = f.metal ? (f.lightInk ? CHIP_FILL.metalOnDarkMini : CHIP_FILL.metalOnLight) : CHIP_FILL.gold
  return (
    <span
      dir="ltr"
      data-card-face="mini"
      className="relative box-border flex h-14 w-[88px] shrink-0 flex-col overflow-hidden rounded-[7px] px-[7px] py-1.5"
      style={{
        color: f.ink,
        background: f.background,
        boxShadow: `${selected ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary), ' : ''}0 1px 2px rgba(13,26,24,.18), inset 0 1px 0 rgba(255,255,255,${f.lightInk ? '.14' : '.5'})`,
        border: f.lightInk ? 'none' : '1px solid rgba(4,32,28,.10)',
      }}
    >
      {!f.metal ? (
        <svg className="absolute left-0 top-0" width="88" height="56" viewBox="0 0 88 56" aria-hidden>
          <path d="M-4 40 C16 30, 30 52, 52 38 S78 26, 92 32" fill="none" stroke={line} strokeWidth=".8" />
          <path d="M-4 45 C16 35, 30 57, 52 43 S78 31, 92 37" fill="none" stroke={line} strokeWidth=".8" />
        </svg>
      ) : null}
      <i aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,${f.metal ? '.16' : '.07'}) 48%, transparent 64%)` }} />
      <span className="relative flex items-baseline justify-between gap-1">
        <span data-slot="bank" className="shrink-0 text-[10px] font-bold leading-3 tracking-[0.01em]" style={{ textShadow: engrave }}>{bank}</span>
        <span data-slot="kind" className="min-w-0 truncate text-[8.5px] font-extrabold uppercase leading-[11px] tracking-[0.08em]" style={{ textShadow: engrave }}>{kind}</span>
      </span>
      <span className="relative mt-auto flex items-center justify-between gap-1">
        <i aria-hidden className="h-2.5 w-[13px] shrink-0 rounded-[2.5px]" style={{ background: chip, boxShadow: 'inset 0 0 0 .75px rgba(0,0,0,.3)' }} />
        <span data-slot="digits" className="font-mono-numbers text-[11px] font-semibold leading-3 tracking-[0.04em]" style={{ textShadow: engrave }}>
          {method.last4 ? `••${method.last4}` : '••••'}
        </span>
      </span>
    </span>
  )
}
