'use client'

import { CreditCard, Smartphone, User } from 'lucide-react'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

export type AddDebtKind = 'borrow' | 'installment' | 'credit_card'

/** Where each choice goes: a credit card is added on the payment-method sheet, the others on the debt sheet's form. */
export function addDebtTarget(kind: AddDebtKind): { modal: 'addCreditCard' } | { family: 'personal' | 'installment' } {
  if (kind === 'credit_card') return { modal: 'addCreditCard' }
  return { family: kind === 'installment' ? 'installment' : 'personal' }
}

/**
 * "Add a debt": what are you tracking? Borrowed money, an installment plan or a credit card. One sheet for the Debts page
 * and for the Pay debt picker's "Add a debt" / "Add new debt" (which used to fall back to an older pick step).
 * `overSheet` when it opens over another sheet that already dims the page.
 */
export function AddDebtOptionSheet({ open, onClose, overSheet = false }: { open: boolean; onClose: () => void; overSheet?: boolean }) {
  const c = useDebtsSubsLtCopy().debts
  const t = useT()
  const requireAuth = useRequireAuthAction()
  const pick = (kind: AddDebtKind) =>
    requireAuth(() => {
      const target = addDebtTarget(kind)
      const ui = useSettingsStore.getState()
      if ('modal' in target) ui.setActiveModal(target.modal)
      else ui.openDebtSheetNew(target.family)
    }, t.debts.requireAuthNew)

  return (
    <OptionSheet<AddDebtKind>
      open={open}
      onClose={onClose}
      overSheet={overSheet}
      title={c.addTitle}
      subtitle={c.addSub}
      value={null}
      onChange={pick}
      options={[
        { value: 'borrow', title: c.addBorrow.title, subtitle: c.addBorrow.sub, icon: <User />, tone: 'var(--color-brand-amber)' },
        { value: 'installment', title: c.addInstallment.title, subtitle: c.addInstallment.sub, icon: <Smartphone />, tone: 'var(--color-brand-primary)' },
        { value: 'credit_card', title: c.addCard.title, subtitle: c.addCard.sub, icon: <CreditCard />, tone: 'var(--color-brand-green)' },
      ]}
    />
  )
}
