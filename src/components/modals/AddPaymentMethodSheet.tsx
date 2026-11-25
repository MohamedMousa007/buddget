'use client'

import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * The app-wide 'addPaymentMethod' entry (`openAddPaymentMethodWithPrefill`): the detected-accounts sheet and Buddgy's
 * navigation tool open the card form with a prefill from anywhere, without visiting Accounts.
 */
export function AddPaymentMethodSheet() {
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const open = useSettingsStore((s) => s.activeModal === 'addPaymentMethod')
  const pmPrefill = useSettingsStore((s) => s.pmPrefill)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const clearPmPrefill = useSettingsStore((s) => s.clearPmPrefill)
  const close = () => { clearPmPrefill(); setActiveModal(null) }
  return <PaymentMethodSetupSheet open={open} editing={null} prefill={open ? pmPrefill : null} baseCurrency={baseCurrency} onClose={close} />
}
