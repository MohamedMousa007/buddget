import type { PaymentMethod } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { CHIP_FILL, bankAbbreviation, cardBankName } from '@/lib/payment/cardThemes'
import { FACE_BLUR, MODERN_SCRIM, faceBackground, faceOf, facePattern, familyOf, type FaceDesign } from '@/lib/payment/cardFaces'
import { INK_LIGHT } from '@/lib/ui/contrast'
import { cardKindLabel } from './accountDisplay'

const W = 88
const SCALE = W / 340

/**
 * The 88×56 mini card (radius 7) of the approved design: the bank's short name on the left, the card type on the
 * right, a chip and the last four digits below, on the card's v9 face (design and colour, no lighting). Same face as
 * the large card, so a card looks the same everywhere. `parent` names the bank for a card that hangs under an account;
 * `face` previews a look before it is saved.
 */
export function CardFaceChip({ method, parent, selected = false, face }: { method: PaymentMethod; parent?: PaymentMethod | null; selected?: boolean; face?: FaceDesign }) {
  const t = useT().accountsPage
  const f = face ?? faceOf(method)
  const modern = familyOf(f.design) === 'modern'
  const bank = bankAbbreviation(cardBankName(method, parent))
  const kind = cardKindLabel(method.type, t)
  const engrave = '0 1px 0 rgba(0,0,0,.55)'
  const chip = modern ? CHIP_FILL.metalOnDarkMini : CHIP_FILL.gold
  const blur = FACE_BLUR[f.design]
  return (
    <span
      dir="ltr"
      data-card-face="mini"
      className="relative box-border flex h-14 w-[88px] shrink-0 flex-col overflow-hidden rounded-[7px] px-[7px] py-1.5"
      style={{
        color: INK_LIGHT,
        background: faceBackground(f, SCALE),
        boxShadow: `${selected ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary), ' : ''}0 1px 2px rgba(13,26,24,.18), inset 0 1px 0 rgba(255,255,255,.14)`,
      }}
    >
      <svg className="absolute left-0 top-0" width={W} height={56} viewBox="0 0 340 214" preserveAspectRatio="none" aria-hidden
        style={blur ? { filter: `blur(${(blur * SCALE).toFixed(1)}px)` } : undefined} dangerouslySetInnerHTML={{ __html: facePattern(f.design, true) }} />
      {modern ? <i aria-hidden className="absolute inset-0" style={{ background: MODERN_SCRIM }} /> : null}
      <span className="relative flex items-baseline justify-between gap-1">
        <span data-slot="bank" className="shrink-0 text-[0.625rem] font-bold leading-3 tracking-[0.01em]" style={{ textShadow: engrave }}>{bank}</span>
        <span data-slot="kind" className="min-w-0 truncate text-[0.53125rem] font-extrabold uppercase leading-[11px] tracking-[0.08em]" style={{ textShadow: engrave }}>{kind}</span>
      </span>
      <span className="relative mt-auto flex items-center justify-between gap-1">
        <i aria-hidden className="h-2.5 w-[13px] shrink-0 rounded-[2.5px]" style={{ background: chip, boxShadow: 'inset 0 0 0 .75px rgba(0,0,0,.3)' }} />
        <span data-slot="digits" className="font-mono-numbers text-[0.6875rem] font-semibold leading-3 tracking-[0.04em]" style={{ textShadow: engrave }}>
          {method.last4 ? `••${method.last4}` : '••••'}
        </span>
      </span>
    </span>
  )
}
