import type { DebtCurrency, DebtKind, DebtReceivedVia, GoldKarat, InstallmentProvider } from '@/lib/store/types'

export interface AddDebtNewFormProps {
  debtType: DebtKind
  setDebtType: (k: DebtKind) => void
  name: string
  setName: (v: string) => void
  person: string
  setPerson: (v: string) => void
  receivedVia: DebtReceivedVia
  onReceivedViaChange: (v: DebtReceivedVia) => void
  startingBalance: string
  setStartingBalance: (v: string) => void
  currency: DebtCurrency
  setCurrency: (c: DebtCurrency) => void
  goldKarat: GoldKarat
  setGoldKarat: (v: GoldKarat) => void
  relationship: string
  setRelationship: (v: string) => void
  direction: 'i_owe' | 'they_owe'
  setDirection: (v: 'i_owe' | 'they_owe') => void
  creditor: string
  setCreditor: (v: string) => void
  ccLast4: string
  setCcLast4: (v: string) => void
  ccCreditLimit: string
  setCcCreditLimit: (v: string) => void
  ccPaymentDueDay: string
  setCcPaymentDueDay: (v: string) => void
  ccGraceDays: string
  setCcGraceDays: (v: string) => void
  ccMinPercent: string
  setCcMinPercent: (v: string) => void
  creditCardDebts: { id: string; name: string }[]
  installmentProvider: InstallmentProvider
  setInstallmentProvider: (k: InstallmentProvider) => void
  linkedCreditCardDebtId: string
  setLinkedCreditCardDebtId: (id: string) => void
  installmentItemName: string
  setInstallmentItemName: (v: string) => void
  installmentCount: string
  setInstallmentCount: (v: string) => void
  installmentFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
  setInstallmentFrequency: (v: 'weekly' | 'monthly' | 'quarterly' | 'annually') => void
  installmentStartDate: string
  setInstallmentStartDate: (v: string) => void
  installmentPreview: number | null
}
