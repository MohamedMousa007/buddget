'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PickerSheet } from '@/components/ui/PickerSheet'
import { useT } from '@/lib/i18n'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'

/** One day cell of a 1–31 month grid (44px): `solid` is the picked day, `derived` one that follows from it. */
export function dayCellClass(state: 'solid' | 'derived' | 'idle'): string {
  return `flex h-11 items-center justify-center rounded-md font-mono-numbers text-sm font-semibold transition-colors ${
    state === 'solid'
      ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
      : state === 'derived'
        ? 'bg-[color-mix(in_oklab,var(--color-brand-primary)_18%,transparent)] text-[var(--color-brand-primary-ink)]'
        : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
  }`
}

export interface DayOfMonthSheetProps {
  open: boolean
  /** 1–31, or null when nothing is picked yet. */
  value: number | null
  /** Fired on Done with the picked day; the sheet closes itself. */
  onChange: (day: number) => void
  onClose: () => void
  title: string
  zIndexClassName?: string
}

/** A day of the month (payday, due day): the 1–31 grid and the chosen day as a big ordinal above it. Nothing to type. */
export function DayOfMonthSheet({ open, value, onChange, onClose, title, zIndexClassName }: DayOfMonthSheetProps) {
  const t = useT()
  const c = useLightTouchCopy().dayOfMonth
  const [day, setDay] = useState(value ?? 1)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDay(value ?? 1)
  }

  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title={title}
      zIndexClassName={zIndexClassName}
      footer={<Button size="cta-block" onClick={() => { onChange(day); onClose() }}>{t.common.done}</Button>}
    >
      <div className="flex flex-col items-center pb-1">
        <p dir="auto" className="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">{c.ordinal(day)}</p>
        <p className="mt-2 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.ofEachMonth}</p>
      </div>
      <div role="radiogroup" aria-label={title} dir="ltr" className="grid grid-cols-7 gap-1 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-2">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={d === day}
            onClick={() => setDay(d)}
            className={dayCellClass(d === day ? 'solid' : 'idle')}
          >
            {d}
          </button>
        ))}
      </div>
    </PickerSheet>
  )
}
