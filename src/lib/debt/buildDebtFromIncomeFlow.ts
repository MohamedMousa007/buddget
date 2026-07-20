import type {
  AppSettings,
  Currency,
  Debt,
  DebtCurrency,
  DebtGoal,
  DebtKind,
  DebtReceivedVia,
  GoldKarat,
  InstallmentProvider,
} from '@/lib/store/types'
import { clampDebtFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { debtIsGoldFromReceived } from '@/lib/debt/debtReceivedViaMap'

export type IncomeDebtFlowInput = {
  incomeName: string
  incomeAmount: number
  incomeCurrency: Currency
  debtType: DebtKind
  /** Counterparty / "who is this from" for personal & general */
  personStr: string
  description?: string
  relationship?: string
  creditor?: string
  installmentItemName: string
  installmentCount: string
  installmentFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
  installmentStartDate: string
  interestFree: boolean
  receivedVia: DebtReceivedVia
  goldKarat: GoldKarat
  goal?: DebtGoal | null
  installmentProvider?: InstallmentProvider
  linkedCreditCardDebtId?: string
}

/**
 * Builds the debt row for "borrowed money" income: direction is always i_owe; amount/currency match income (or XAU for gold).
 */
export function buildDebtFromIncomeFlow(
  settings: AppSettings,
  input: IncomeDebtFlowInput
): Omit<Debt, 'id' | 'createdAt'> {
  const isGold = debtIsGoldFromReceived(input.receivedVia)
  const total = input.incomeAmount
  const currency: DebtCurrency = isGold ? 'XAU' : clampDebtFiatToAllowed(settings, input.incomeCurrency)
  const { debtType } = input
  const baseEmoji = isGold ? '🪙' : '💳'

  const payload: Omit<Debt, 'id' | 'createdAt'> = {
    name:
      debtType === 'installment' ? input.installmentItemName.trim() : input.incomeName.trim(),
    person:
      debtType === 'installment'
        ? 'Installment'
        : debtType === 'general'
          ? input.personStr.trim() || input.creditor?.trim() || 'General'
          : input.personStr.trim(),
    description: input.description?.trim() || undefined,
    startingBalance: total,
    currency,
    isGold,
    goldKarat: isGold ? input.goldKarat : undefined,
    debtType,
    emoji: baseEmoji,
    status: 'active',
    receivedVia: input.receivedVia,
  }

  if (debtType === 'personal') {
    payload.relationship = input.relationship?.trim() || undefined
    payload.direction = 'i_owe'
    payload.personName = input.personStr.trim()
  }
  if (debtType === 'installment') {
    // Shariaa: fixed figures only — per-installment is total ÷ count, never a rate.
    const n = Math.max(1, parseInt(input.installmentCount, 10) || 1)
    const per = total / n
    payload.installmentCount = n
    payload.installmentFrequency = input.installmentFrequency
    payload.startDate = input.installmentStartDate
    payload.installmentAmount = Math.round(per * 100) / 100
    if (input.installmentProvider) {
      payload.installmentProvider = input.installmentProvider
    }
    if (input.linkedCreditCardDebtId) {
      payload.linkedCreditCardDebtId = input.linkedCreditCardDebtId
    }
  }
  if (debtType === 'general') {
    payload.creditor = input.creditor?.trim() || undefined
    payload.personName = input.personStr.trim() || undefined
  }
  if (input.goal) {
    payload.goal = input.goal
  }

  return payload
}
