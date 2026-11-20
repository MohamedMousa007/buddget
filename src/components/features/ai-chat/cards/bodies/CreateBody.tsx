'use client'

import { BrandMark } from '@/components/features/accounts/BrandMark'
import { cardKindLabel } from '@/components/features/accounts/accountDisplay'
import { CardFace } from '@/components/features/payments/CardFace'
import { ProgressRing } from '@/components/ui/ProgressRing'
import type { PreviewModel } from '@/lib/buddgy/tools/proposal'
import { useT } from '@/lib/i18n'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { bankAbbreviation, cardBankName, cardLook } from '@/lib/payment/cardThemes'
import type { PaymentMethod } from '@/lib/store/types'
import { QuestionField } from '../QuestionField'
import { Facts, Line } from './parts'

/** The large card face fits the chat column at this scale. */
const FACE_SCALE = 0.6

function CardPreview({ card }: { card: NonNullable<PreviewModel['card']> }) {
  const t = useT().accountsPage
  const draft = { id: 'draft', isDefault: false, ...card, currency: card.currency ?? 'EGP' } as PaymentMethod
  const { theme, style } = cardLook(draft)
  return (
    <div className="flex justify-center py-1">
      <CardFace theme={theme} style={style} bank={bankAbbreviation(cardBankName(draft)) || card.name} kind={cardKindLabel(card.type, t)} last4={card.last4} currency={card.currency} scale={FACE_SCALE} />
    </div>
  )
}

/** Create: the thing as the app will show it, its facts, then anything still missing asked as a question. */
export function CreateBody({ preview, onRevise }: { preview: PreviewModel; onRevise: (patch: Record<string, string>) => void }) {
  const copy = useBuddgyCardCopy().question
  const name = preview.rows[0]?.value ?? preview.title
  const asks = (preview.missing ?? []).map((k) => preview.fields?.find((f) => f.key === k)).filter((f) => f !== undefined)
  return (
    <>
      {preview.card ? (
        <CardPreview card={preview.card} />
      ) : (
        <div className="flex items-center gap-3">
          {preview.entity === 'goal' ? (
            <ProgressRing pct={0} size={56} stroke={5}>
              <span className="font-mono-numbers text-xs font-semibold">0%</span>
            </ProgressRing>
          ) : (
            <BrandMark name={name} color="var(--color-brand-primary)" size={44} />
          )}
          <span dir="auto" className="min-w-0 flex-1 truncate text-base font-semibold">{name}</span>
        </div>
      )}
      <Facts rows={preview.rows} />
      {preview.effect ? <Line>{preview.effect}</Line> : null}
      {asks.length > 0 ? (
        <div className="flex flex-col gap-2.5 border-t border-[var(--color-brand-border)] pt-3">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{copy.stillNeed}</span>
          {asks.map((f) => (
            <QuestionField key={f.key} field={f} onAnswer={(v) => onRevise({ [f.key]: v })} />
          ))}
        </div>
      ) : null}
    </>
  )
}
