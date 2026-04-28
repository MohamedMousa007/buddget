'use client'

import { Input } from '@/components/ui/input'
import type { DebtKind } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { MODAL_CONTROL_CLASS, MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'

export function AddDebtNewFormPersonDesc({
  debtType,
  name,
  setName,
  person,
  setPerson,
}: {
  debtType: DebtKind
  name: string
  setName: (v: string) => void
  person: string
  setPerson: (v: string) => void
}) {
  const t = useT()
  if (debtType === 'installment' || debtType === 'credit_card') {
    return null
  }
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor="debt-name" className={MODAL_LABEL_CLASS}>
          {t.addDebt.labelName}
        </label>
        <Input
          id="debt-name"
          placeholder={t.addDebt.placeholderName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
        />
      </div>
      <div>
        <label htmlFor="debt-person" className={MODAL_LABEL_CLASS}>
          {t.addDebt.labelPerson}
        </label>
        <Input
          id="debt-person"
          placeholder={t.addDebt.placeholderPerson}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
        />
      </div>
    </div>
  )
}
