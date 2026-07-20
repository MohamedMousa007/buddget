import type {
  Debt,
  Currency,
  DebtCurrency,
  DebtKind,
  DebtReceivedVia,
  GoldKarat,
  InstallmentProvider,
} from '@/lib/store/types'
import type { DebtRow, DebtInsert } from '@/lib/supabase/remote/types'

function toDbDebtKind(k: DebtKind | undefined): DebtInsert['debt_type'] {
  if (!k) return 'personal'
  // DB enum: personal | installment | credit_card | mortgage | loan | other
  // Legacy: 'general' → map to 'other'
  if (k === 'general') return 'other'
  return k as DebtInsert['debt_type']
}

function fromDbDebtKind(k: DebtRow['debt_type']): DebtKind {
  if (k === 'mortgage' || k === 'loan' || k === 'other') return 'general'
  return k as DebtKind
}

function toDbReceivedVia(
  v: DebtReceivedVia | undefined
): DebtInsert['received_via'] {
  if (!v) return null
  // DB enum: cash | bank_transfer | card | gold | other
  if (v === 'crypto') return 'other'
  return v as DebtInsert['received_via']
}

function toDbKarat(k: GoldKarat | undefined): DebtInsert['gold_karat'] {
  if (!k) return null
  return String(k) as DebtInsert['gold_karat']
}

function fromDbKarat(k: DebtRow['gold_karat']): GoldKarat | undefined {
  if (!k) return undefined
  const n = Number(k)
  if (n === 24 || n === 22 || n === 21 || n === 18) return n
  return undefined
}

export function debtToRow(d: Debt, userId: string): DebtInsert {
  return {
    id: d.id,
    user_id: userId,
    name: d.name,
    description: d.description ?? d.notes ?? null,
    debt_type: toDbDebtKind(d.debtType),
    direction: d.direction ?? 'i_owe',
    amount: d.startingBalance,
    currency: (d.currency as Currency) ?? 'AED',
    starting_balance: d.startingBalance,
    remaining_amount: null,
    interest_rate: 0,
    interest_free: d.interestFree ?? true,
    person: d.personName ?? d.person ?? null,
    relationship: d.relationship ?? null,
    creditor: d.creditor ?? null,
    due_date: null,
    started_at: d.startDate ?? null,
    installment_item_name: null,
    installment_count: d.installmentCount ?? null,
    installment_amount: d.installmentAmount ?? null,
    installment_frequency: d.installmentFrequency
      ? (d.installmentFrequency as DebtInsert['installment_frequency'])
      : null,
    installment_start_date: null,
    installment_provider: d.installmentProvider
      ? (d.installmentProvider as DebtInsert['installment_provider'])
      : null,
    installment_provider_name: d.installmentProviderName ?? null,
    linked_credit_card_debt_id: d.linkedCreditCardDebtId ?? null,
    linked_payment_method_id: d.linkedPaymentMethodId ?? null,
    credit_limit: d.creditLimit ?? null,
    // Drive the billing cycle / next due date / minimum payment. Without these the card
    // is unusable on a second device — getCurrentBillingCycleExpenses bails and the card
    // shows its setup banner forever.
    payment_due_day: d.paymentDueDay ?? null,
    grace_period_days: d.gracePeriodDays ?? null,
    minimum_payment_percent: d.minimumPaymentPercent ?? null,
    status: d.status ?? 'active',
    cleared_at: d.clearedAt ?? null,
    received_via: toDbReceivedVia(d.receivedVia),
    gold_karat: toDbKarat(d.goldKarat),
    is_gold: d.isGold,
    notes: d.notes ?? null,
    created_at: d.createdAt,
    updated_at: d.updatedAt ?? d.createdAt,
  }
}

export function debtFromRow(row: DebtRow): Debt {
  return {
    id: row.id,
    name: row.name,
    person: row.person ?? '',
    personName: row.person ?? undefined,
    description: row.description ?? undefined,
    startingBalance: row.starting_balance ?? row.amount,
    currency: (row.currency as DebtCurrency) ?? 'AED',
    isGold: row.is_gold,
    receivedVia: (row.received_via as DebtReceivedVia | null) ?? undefined,
    goldKarat: fromDbKarat(row.gold_karat),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    status: (row.status as 'active' | 'cleared' | null) ?? 'active',
    clearedAt: row.cleared_at ?? undefined,
    linkedPaymentMethodId: row.linked_payment_method_id ?? undefined,
    creditLimit: row.credit_limit ?? undefined,
    paymentDueDay: row.payment_due_day ?? undefined,
    gracePeriodDays: row.grace_period_days ?? undefined,
    minimumPaymentPercent: row.minimum_payment_percent ?? undefined,
    debtType: fromDbDebtKind(row.debt_type),
    relationship: row.relationship ?? undefined,
    direction: (row.direction as 'i_owe' | 'they_owe') ?? undefined,
    installmentCount: row.installment_count ?? undefined,
    installmentAmount: row.installment_amount ?? undefined,
    installmentFrequency: row.installment_frequency
      ? (row.installment_frequency as 'weekly' | 'monthly' | 'quarterly' | 'annually')
      : undefined,
    startDate: row.started_at ?? undefined,
    interestFree: row.interest_free,
    creditor: row.creditor ?? undefined,
    installmentProvider: row.installment_provider
      ? (row.installment_provider as InstallmentProvider)
      : undefined,
    installmentProviderName: row.installment_provider_name ?? undefined,
    linkedCreditCardDebtId: row.linked_credit_card_debt_id ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}
