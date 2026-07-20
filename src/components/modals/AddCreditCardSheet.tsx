'use client'

import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * Debt-tab "Add credit card" — the SAME payment-method setup sheet (§6 unify),
 * locked to the Credit card type. Adding a card auto-creates its credit-card debt
 * and the sheet persists the limit / outstanding / statement day / grace terms.
 */
export function AddCreditCardSheet() {
  const activeModal = useSettingsStore((s) => s.activeModal)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)

  return (
    <PaymentMethodSetupSheet
      open={activeModal === 'addCreditCard'}
      editing={null}
      baseCurrency={baseCurrency}
      lockType="credit_card"
      titleOverride="Add credit card"
      onClose={() => setActiveModal(null)}
    />
  )
}
