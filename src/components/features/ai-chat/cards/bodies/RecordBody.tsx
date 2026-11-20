'use client'

import type { PreviewModel } from '@/lib/buddgy/tools/proposal'
import { AmountHero, EffectLine, Facts } from './parts'
import { pickerKeys, RecordPickers } from './RecordPickers'

/** Quick record: the amount large, then Paid with / Category / Date as lines that open their pickers. */
export function RecordBody({ preview, onRevise }: { preview: PreviewModel; onRevise: (patch: Record<string, string>) => void }) {
  const drawn = new Set<string>([...pickerKeys(preview), ...(preview.amount !== undefined ? ['amount'] : []), ...(preview.what ? ['description'] : [])])
  const rest = preview.rows.filter((r) => !r.key || !drawn.has(r.key))
  return (
    <>
      {preview.amount !== undefined ? <AmountHero amount={preview.amount} currency={preview.currency} what={preview.what} /> : null}
      <RecordPickers preview={preview} onRevise={onRevise} />
      <Facts rows={rest} />
      {preview.effect ? <EffectLine>{preview.effect}</EffectLine> : null}
    </>
  )
}
