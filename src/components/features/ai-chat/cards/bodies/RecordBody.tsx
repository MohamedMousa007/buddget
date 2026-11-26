'use client'

import type { PreviewModel } from '@/lib/buddgy/tools/proposal'
import { AmountHero, EffectLine, Facts } from './parts'
import { pickerKeys, RecordPickers } from './RecordPickers'

/**
 * Quick record: the amount large, then Paid with / Category / Date as lines that open their pickers. `light` (Light
 * touch) centres the amount and boxes the lines, with the effect as one quiet amber line.
 */
export function RecordBody({ preview, onRevise, light = false }: { preview: PreviewModel; onRevise: (patch: Record<string, string>) => void; light?: boolean }) {
  const drawn = new Set<string>([...pickerKeys(preview), ...(preview.amount !== undefined ? ['amount'] : []), ...(preview.what ? ['description', 'name'] : [])])
  const rest = preview.rows.filter((r) => !r.key || !drawn.has(r.key))
  return (
    <>
      {preview.amount !== undefined ? <AmountHero amount={preview.amount} currency={preview.currency} what={preview.what} align={light ? 'center' : 'start'} /> : null}
      <RecordPickers preview={preview} onRevise={onRevise} boxed={light} />
      <Facts rows={rest} />
      {preview.effect ? <EffectLine plain={light}>{preview.effect}</EffectLine> : null}
    </>
  )
}
