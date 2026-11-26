'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { microClassName } from '@/lib/ui/microLabelStyle'

/** A titled group of 52px rows with an optional note under it (the Light touch sheet list). */
export function SheetGroup({ label, note, children }: { label?: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {label ? <h3 className={`${microClassName} mb-2 px-1`}>{label}</h3> : null}
      <Card padding="none" divide className="overflow-hidden">{children}</Card>
      {note ? <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{note}</p> : null}
    </section>
  )
}

/** A row whose value is typed in place ("Person", "Item", "Name"). */
export function TextRow({ label, value, onChange, placeholder, disabled }: {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <PickerRow
      label={label}
      value={
        <input
          dir="auto"
          aria-label={label}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-end outline-none placeholder:font-normal placeholder:text-[var(--color-brand-text-muted)] disabled:opacity-70"
        />
      }
    />
  )
}

/** The tinted 52px icon tile above a money sheet's amount (payment, repayment, payday). */
export function TxTile({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl [&_svg]:size-6" style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}>
      {children}
    </span>
  )
}
