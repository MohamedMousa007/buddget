'use client'

import { useState } from 'react'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { PickerSheet } from '@/components/ui/PickerSheet'
import { useT } from '@/lib/i18n'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'

export interface NumberPickerSheetProps {
  open: boolean
  value: number
  /** Fired on Done with a whole number from 1 to `max`; the sheet closes itself. */
  onChange: (n: number) => void
  onClose: () => void
  title: string
  /** Quick picks under the number, four to a row. */
  presets: readonly number[]
  /** The unit after the number, worded for it ("12 payments", "1 payment"). */
  unit: (n: number) => string
  max?: number
  zIndexClassName?: string
}

/** A count (payments, months): type any number, or tap a preset. */
export function NumberPickerSheet({ open, value, onChange, onClose, title, presets, unit, max = 999, zIndexClassName }: NumberPickerSheetProps) {
  const t = useT()
  const c = useLightTouchCopy().numberPicker
  const [draft, setDraft] = useState(String(value))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(String(value))
  }
  const n = Math.min(max, Number.parseInt(draft, 10) || 0)
  const set = (next: string) => setDraft(next.slice(0, String(max).length))

  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title={title}
      zIndexClassName={zIndexClassName}
      footer={<Button size="cta-block" disabled={n < 1} onClick={() => { onChange(n); onClose() }}>{t.common.done}</Button>}
    >
      <AmountHero value={draft} onChange={set} mode="integer" unit={unit(n)} line={c.hint} aria-label={title} className="pb-1" />
      <div className="grid grid-cols-4 gap-2">
        {presets.map((p) => (
          <OptionChip key={p} size="segment" selected={p === n} onClick={() => setDraft(String(p))} className="h-12 font-mono-numbers text-[0.9375rem]">
            {p}
          </OptionChip>
        ))}
      </div>
    </PickerSheet>
  )
}
