'use client'

import { useState } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import type { EditableField } from '@/lib/buddgy/tools/proposal'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { AccountPick } from './pickers/AccountPick'
import { DatePick } from './pickers/DatePick'

/** Arg keys that name an account or pocket: asked as account rows, not bare chips. */
const ACCOUNT_KEYS: ReadonlySet<string> = new Set(['account', 'pocket', 'from', 'to'])

/** A field the person has not given, asked inside the card with the control that fits it. The answer revises the card. */
export function QuestionField({ field, onAnswer }: { field: EditableField; onAnswer: (value: string) => void }) {
  const copy = useBuddgyCardCopy().question
  const [draft, setDraft] = useState(field.value)
  const options = field.options ?? []
  return (
    <div role="group" aria-label={field.label} className="flex flex-col gap-3">
      <p dir="auto" className="text-base font-semibold">{field.label}</p>
      {field.kind === 'select' && ACCOUNT_KEYS.has(field.key) ? (
        <AccountPick label={field.label} value={field.value} options={options.map((o) => ({ value: o.value, name: o.label }))} onPick={onAnswer} />
      ) : field.kind === 'select' ? (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <OptionChip key={o.value} selected={o.value === field.value} onClick={() => onAnswer(o.value)}>{o.label}</OptionChip>
          ))}
        </div>
      ) : field.kind === 'date' ? (
        <DatePick value={field.value} onPick={onAnswer} />
      ) : (
        <>
          {field.kind === 'amount' ? (
            <AmountField value={draft} onChange={setDraft} currency={field.currency} label={field.label} className="bg-[var(--color-brand-elevated)]" />
          ) : (
            <Input size="brand" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={field.label} />
          )}
          <Button size="cta-block" disabled={draft.trim() === ''} onClick={() => onAnswer(draft.trim())}>{copy.save}</Button>
        </>
      )}
    </div>
  )
}
