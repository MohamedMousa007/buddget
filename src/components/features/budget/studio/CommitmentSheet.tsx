'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Currency } from '@/lib/store/types'
import { useBudgetStudioCopy } from '../useStudioCopy'

export interface CommitmentDraft {
  /** Editable for a described cost; fixed (and not shown as a field) for utilities and holdings. */
  name: string
  nameEditable: boolean
  amount: number
  /** A holding is a total value, not a monthly cost. */
  total?: boolean
}

export interface CommitmentSheetProps {
  open: boolean
  draft: CommitmentDraft | null
  /** Title shown for a fixed name (utilities, a holding). */
  title?: string
  base: Currency
  onSave: (next: { name: string; amount: number }) => void
  onRemove: () => void
  onClose: () => void
}

/** Changes or removes one cost or holding Buddgy picked out of the description. */
export function CommitmentSheet({ open, draft, title, base, onSave, onRemove, onClose }: CommitmentSheetProps) {
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      {open && draft ? <Body key={`${draft.name}:${draft.amount}`} draft={draft} title={title} base={base} onSave={onSave} onRemove={onRemove} onClose={onClose} /> : null}
    </ModalShell>
  )
}

function Body({ draft, title, base, onSave, onRemove, onClose }: Omit<CommitmentSheetProps, 'open' | 'draft'> & { draft: CommitmentDraft }) {
  const c = useBudgetStudioCopy().extraSheet
  const [name, setName] = useState(draft.name)
  const [amount, setAmount] = useState(String(draft.amount))
  const value = Number(amount) || 0
  const ok = value > 0 && name.trim().length > 0
  return (
    <div className="flex flex-col gap-4 pt-1">
      <V3SheetHeader title={draft.nameEditable ? c.title : (title ?? draft.name)} onClose={onClose} />
      {draft.nameEditable ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commitment-name">{c.name}</Label>
          <Input id="commitment-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value.replace(/\|/g, ''))} size="brand" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="commitment-amount">{draft.total ? c.total : c.amount}</Label>
        <AmountField id="commitment-amount" value={amount} onChange={setAmount} currency={base} label={draft.total ? c.total : c.amount} />
      </div>
      <div className="flex flex-col gap-2">
        <Button size="cta" className="w-full" disabled={!ok} onClick={() => onSave({ name: name.trim(), amount: Math.round(value * 100) / 100 })}>
          {c.save}
        </Button>
        <Button size="touch" variant="ghost" className="w-full text-[var(--color-brand-red)]" onClick={onRemove}>
          {c.remove}
        </Button>
      </div>
    </div>
  )
}
