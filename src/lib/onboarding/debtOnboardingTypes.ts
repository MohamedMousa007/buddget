import type { DebtCurrency, GoldKarat } from '@/lib/store/types'

/** Payload shape when applying onboarding debt draft rows to the finance store. */
export type DebtOnboardingPayload = {
  entries: Array<{
    name: string
    person: string
    description?: string
    startingBalance: number
    currency: DebtCurrency
    isGold: boolean
    goldKarat?: GoldKarat
    notes?: string
  }>
}
