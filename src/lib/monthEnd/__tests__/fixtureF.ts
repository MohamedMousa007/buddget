import type { Debt, Expense, Goal, IncomeEvent, PaymentMethod, SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import type { LedgerInput } from '@/lib/accounts/balance'
import { localDay } from '@/lib/savings/carryDateLogic'
import { ratesConverter, type BaseRates } from '../context'

/**
 * Fixture F (LOGIC_SPEC §6) for the P6 tests, dates in 2025 like P1–P5. Cycle C = Nov 1–Dec 1. The card (statement
 * close 10th) holds back 6,000 until Dec 10.
 */
export const R50: BaseRates = { USD: 50 }
export const NOV: { start: string; end: string } = { start: '2025-11-01', end: '2025-12-01' }
export const DEC = { start: '2025-12-01', end: '2026-01-01' }
const OPEN = '2025-11-01T00:00:00.000Z'
export const at = (month: number, day: number, hour = 18) => new Date(month > 12 ? 2026 : 2025, (month - 1) % 12, day, hour).getTime()
export const C_END = new Date(2025, 11, 1, 0, 0).getTime() - 1
export const dayOf = (s: string) => localDay(new Date(s), 'Africa/Cairo')

export const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2025-11-01', openingAt: OPEN, ...over }) as PaymentMethod
export const part = (id: string, currentBalance: number, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'vault', currency: 'EGP', currentBalance, createdAt: '2025-11-01', ...over }) as SavingsAccount
export const expense = (id: string, amount: number, paymentMethodId: string, date: string, over: Partial<Expense> = {}): Expense =>
  ({ id, amount, currency: 'EGP', category: 'Food', description: id, date, paymentMethodId, isRecurring: false, createdAt: `${date}T09:00:00.000Z`, ...over }) as Expense
export const income = (id: string, amount: number, currency: string, paymentMethodId: string, receivedDate: string): IncomeEvent =>
  ({ id, amount, currency, paymentMethodId, receivedDate, status: 'confirmed', createdAt: `${receivedDate}T09:00:00.000Z` }) as unknown as IncomeEvent
export const tx = (id: string, accountId: string, type: SavingsTransaction['type'], amount: number, date: string, over: Partial<SavingsTransaction> = {}): SavingsTransaction =>
  ({ id, accountId, type, amount, currency: 'EGP', date, isCashFlow: false, createdAt: `${date}T09:00:00.000Z`, ...over }) as SavingsTransaction
export const goal = (id: string, targetAmount: number, priority: number, over: Partial<Goal> = {}): Goal =>
  ({ id, name: id, category: 'quality_of_life', targetAmount, currency: 'EGP', priority, status: 'active', linkedSavingsAccountIds: [], linkedDebtIds: [], manualCurrentAmount: 0, ...over }) as unknown as Goal

const CARD = { id: 'cardDebt', name: 'card', person: '', startingBalance: 0, currency: 'EGP', isGold: false, direction: 'i_owe', status: 'active', createdAt: '2025-11-01', debtType: 'credit_card', linkedPaymentMethodId: 'card', paymentDueDay: 10 } as Debt
const TV = {
  id: 'tv', name: 'TV', person: 'Installment', startingBalance: 12000, currency: 'EGP', isGold: false, direction: 'i_owe', status: 'active',
  debtType: 'installment', installmentCount: 6, installmentAmount: 2000, installmentFrequency: 'monthly', startDate: '2025-12-10',
  installmentProvider: 'credit_card', linkedCreditCardDebtId: 'cardDebt', createdAt: '2025-11-12',
} as Debt

export type Ledger = { -readonly [K in keyof LedgerInput]: LedgerInput[K] extends readonly (infer T)[] ? T[] : LedgerInput[K] }
export interface World {
  ledger: Ledger
  goals: Goal[]
}

/** Fixture F (§6); `f27` = Travel 61,000 (56,000 set aside before November). */
export function fixture({ f27 = false } = {}): World {
  return {
    goals: [goal('car', 150000, 1), goal('wedding', 50000, 3)],
    ledger: {
      paymentMethods: [
        pm('CIB', { openingBalance: 60000 }),
        pm('Deel', { type: 'wallet', currency: 'USD', openingBalance: 700 }),
        pm('Cash', { type: 'cash', openingBalance: 3000 }),
        pm('NBE', { openingBalance: 0 }),
        pm('card', { type: 'credit_card', parentId: 'CIB', openingAt: undefined }),
      ],
      expenses: [
        expense('debit', 20000, 'CIB', '2025-11-10'),
        expense('cashSpend', 1000, 'Cash', '2025-11-12'),
        expense('cardBuys', 4000, 'card', '2025-11-20'),
        expense('tvBuy', 12000, 'card', '2025-11-12'),
      ],
      incomeEvents: [income('salary', 60000, 'EGP', 'CIB', '2025-11-25'), income('freelance', 300, 'USD', 'Deel', '2025-11-20')],
      debts: [CARD, TV],
      debtPayments: [],
      savingsAccounts: [
        part('carCIB', 20000, { heldInPaymentMethodId: 'CIB', goalId: 'car' }),
        part('carDeel', 200, { currency: 'USD', heldInPaymentMethodId: 'Deel', goalId: 'car' }),
        part('travel', f27 ? 61000 : 5000, { heldInPaymentMethodId: 'CIB' }),
        part('ms', 3000, { heldInPaymentMethodId: 'CIB', isMonthlySavings: true }),
        part('wedding', 8.75, { currency: 'XAU', goalId: 'wedding' }),
      ],
      savingsTransactions: [tx('travelNov', 'travel', 'deposit', 5000, '2025-11-15', { source: 'set_aside' })],
      adjustments: [],
      convert: ratesConverter(R50, 'EGP'),
    },
  }
}

