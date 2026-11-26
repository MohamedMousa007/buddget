'use client'

import type { DebtFamily } from '@/lib/debts/debtFamily'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'

/** Borrowed · Installments · Cards: the three families, with no All. */
export function DebtFamilyTabs({ active, onChange }: { active: DebtFamily; onChange: (f: DebtFamily) => void }) {
  const tabs = useDebtsSubsLtCopy().debts.tabs
  const aria = useT().debts.pageTitle
  return (
    <SegmentedControl<DebtFamily>
      ariaLabel={aria}
      value={active}
      onChange={onChange}
      options={[
        { value: 'borrow', label: tabs.borrow },
        { value: 'installment', label: tabs.installment },
        { value: 'credit_card', label: tabs.credit_card },
      ]}
    />
  )
}
