'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/lib/i18n/types'

type Props = { t: Dictionary; notes: string; setNotes: (v: string) => void }

export function AddIncomeNotesField({ t, notes, setNotes }: Props) {
  return (
    <div>
      <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelNotes}</Label>
      <Textarea
        placeholder={t.addIncome.placeholderNotes}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] min-h-[60px]"
      />
    </div>
  )
}
