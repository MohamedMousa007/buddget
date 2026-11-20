'use client'

import { useState } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/SelectField'
import type { EditableField } from '@/lib/buddgy/tools/proposal'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'

function FieldControl({ field, value, onChange }: { field: EditableField; value: string; onChange: (v: string) => void }) {
  if (field.kind === 'amount') return <AmountField value={value} onChange={onChange} currency={field.currency} label={field.label} className="bg-[var(--color-brand-elevated)]" />
  if (field.kind === 'date') return <DatePickerField value={value} onChange={onChange} />
  if (field.kind === 'select') return <SelectField value={value} onChange={onChange} items={field.options ?? []} aria-label={field.label} />
  return <Input size="brand" value={value} onChange={(e) => onChange(e.target.value)} aria-label={field.label} />
}

/** Edit: every editable field of a card in one form; Update revises the proposal, nothing is written. */
export function EditFields({ fields, error, onSave, onCancel }: { fields: EditableField[]; error?: string; onSave: (patch: Record<string, string>) => void; onCancel: () => void }) {
  const copy = useBuddgyChatCopy()
  const [draft, setDraft] = useState<Record<string, string>>({})
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{f.label}</span>
          <FieldControl field={f} value={draft[f.key] ?? f.value} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
        </div>
      ))}
      {error ? <p role="alert" className="text-xs text-[var(--color-brand-red)]">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="touch" className="flex-1" onClick={() => onSave(draft)}>{copy.update}</Button>
        <Button variant="outline" size="touch" onClick={onCancel}>{copy.cancel}</Button>
      </div>
    </div>
  )
}
