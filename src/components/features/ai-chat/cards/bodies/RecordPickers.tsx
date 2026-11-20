'use client'

import { useState } from 'react'
import { CategoryGlyph } from '@/components/dashboard/CategoryIcon'
import type { PreviewModel } from '@/lib/buddgy/tools/proposal'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { CategoryPick } from '../pickers/CategoryPick'
import { DatePick } from '../pickers/DatePick'
import { PayWith } from '../pickers/PayWith'
import { PickerLine } from './parts'

/** The arg keys these lines draw; a body skips the plain rows for them. */
export const PICKER_KEYS = ['method', 'category', 'date'] as const

type Key = (typeof PICKER_KEYS)[number]

/**
 * Which picker lines a preview can offer: the tool keys a row for it (so the line replaces that row) and has an
 * editable field for it (so the tool accepts the answer). Other record tools keep their plain facts.
 */
export function pickerKeys(preview: PreviewModel): Key[] {
  return PICKER_KEYS.filter(
    (k) => preview.rows.some((r) => r.key === k) && preview.fields?.some((f) => f.key === k && (k === 'date' ? f.kind === 'date' : f.kind === 'select')),
  )
}

/**
 * Paid with, Category and Date as lines that open their picker in place. A missing method starts open,
 * so the question is asked inside the card instead of guessed silently.
 */
export function RecordPickers({ preview, onRevise, payLabel }: { preview: PreviewModel; onRevise: (patch: Record<string, string>) => void; payLabel?: string }) {
  const copy = useBuddgyCardCopy()
  const missingMethod = preview.missing?.includes('method') ?? false
  const [open, setOpen] = useState<Key | null>(missingMethod ? 'method' : null)
  const keys = pickerKeys(preview)
  const field = (k: Key) => preview.fields!.find((f) => f.key === k)!
  const row = (k: Key) => preview.rows.find((r) => r.key === k)
  const toggle = (k: Key) => setOpen((o) => (o === k ? null : k))
  const pick = (k: Key) => (v: string) => {
    setOpen(null)
    onRevise({ [k]: v })
  }

  return (
    <div className="flex flex-col">
      {keys.map((k) => {
        const f = field(k)
        const shown = row(k)?.value ?? f.options?.find((o) => o.value === f.value)?.label ?? f.value
        const guessed = preview.guessed?.includes(k) || (k === 'method' && missingMethod) ? copy.guessed : undefined
        return (
          <PickerLine
            key={k}
            label={f.label}
            value={
              <>
                {k === 'category' ? <CategoryGlyph category={f.value} className="size-4" /> : null}
                <span dir="auto" className="truncate">{shown || '—'}</span>
              </>
            }
            aria={copy.change(f.label, shown)}
            open={open === k}
            guessed={guessed}
            onToggle={() => toggle(k)}
          >
            {k === 'method' ? <PayWith value={preview.methodRef ?? f.value} onPick={pick(k)} missing={missingMethod} label={payLabel} /> : null}
            {k === 'category' ? <CategoryPick value={f.value} options={f.options ?? []} onPick={pick(k)} guessed={Boolean(guessed)} /> : null}
            {k === 'date' ? <DatePick value={f.value} onPick={pick(k)} /> : null}
          </PickerLine>
        )
      })}
    </div>
  )
}
