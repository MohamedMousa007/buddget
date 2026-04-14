'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DebtKind } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

export function AddDebtNewFormPersonDesc({
  debtType,
  name,
  setName,
  person,
  setPerson,
  description,
  setDescription,
}: {
  debtType: DebtKind
  name: string
  setName: (v: string) => void
  person: string
  setPerson: (v: string) => void
  description: string
  setDescription: (v: string) => void
}) {
  const t = useT()
  if (debtType === 'installment' || debtType === 'credit_card') {
    return (
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelDescription}</Label>
        <Input
          placeholder={t.addDebt.placeholderDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>
    )
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelName}</Label>
          <Input
            placeholder={t.addDebt.placeholderName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelPerson}</Label>
          <Input
            placeholder={t.addDebt.placeholderPerson}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelDescription}</Label>
        <Input
          placeholder={t.addDebt.placeholderDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>
    </>
  )
}
