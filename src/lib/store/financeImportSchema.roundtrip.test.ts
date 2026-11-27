import { describe, expect, it } from 'vitest'
import { importDataSchema } from './financeImportSchema'
import type { Debt, Expense, IncomeSource, SavingsAccount, SavingsTransaction, UserProfile } from './types'

const at = '2026-10-01T09:00:00.000Z'

const profile: UserProfile = {
  id: 'u1',
  name: 'Sara',
  createdAt: at,
  defaultCarryPocketId: 'acc-1',
  savingsSplit: [{ target_id: 'acc-1', pct: 60 }, { target_id: 'acc-2', pct: 40 }],
  emergencyFundConfig: { targetMonths: 6, coverPocketIds: ['acc-1'], monthlyEssentials: 12000 },
  zakatConfig: { nisabBasis: 'gold', nisabBasisChosen: true, holdsForTrading: false, jewelleryHoldingIds: ['h1'], lastPaidDate: '2026-03-01' },
  financialProfile: { housing: 'rent', dependents: 2, priorities: ['save'], securityLean: 0.4 },
}

const incomeSource: IncomeSource = {
  id: 'i1', name: 'Freelance', amount: 8000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly',
  irregular: true, icon: 'laptop', paydayDays: [1, 15], paydayDriftDays: 3, sortOrder: 2,
  effectiveStart: '2026-01-01', createdAt: at, updatedAt: at,
}

const debt: Debt = {
  id: 'd1', name: 'iPhone', person: 'Tabby', startingBalance: 30000, currency: 'EGP', isGold: false, createdAt: at,
  updatedAt: at, debtType: 'installment', installmentProvider: 'tabby', installmentProviderName: 'Tabby',
  installmentItemType: 'phone', installmentItemIcon: 'smartphone', installmentCount: 4, installmentFrequency: 'monthly',
  installmentAmount: 7500, startDate: '2026-10-01',
}

const savingsAccount: SavingsAccount = {
  id: 'acc-1', name: 'Emergency', category: 'savings', type: 'bank', icon: 'bank', currency: 'EGP', currentBalance: 50000,
  goalId: 'g1', isMonthlySavings: true, createdAt: at, color: 'mint', isEmergencyCover: true, institution: 'CIB',
}

const savingsTx: SavingsTransaction = {
  id: 'st1', accountId: 'acc-1', type: 'deposit', amount: 1000, currency: 'USD', date: '2026-10-02', occurredAt: at,
  paymentMethodId: 'pm1', idempotencyKey: 'idem-1', pairId: 'pair-1', accountAmount: 49500, isCashFlow: true,
  transferGroupId: 'tg1', createdAt: at, updatedAt: at,
}

const expense: Expense = {
  id: 'e1', date: '2026-10-03', occurredAt: at, description: 'Groceries', category: 'Groceries', amount: 20,
  currency: 'USD', amountInBaseCurrency: 990, accountAmount: 990, paymentMethodId: 'pm1', isRecurring: false,
  createdAt: at, updatedAt: at, linkedSubscriptionId: 'sub1', receiptId: 'r1', refundedAt: '2026-10-05',
  refundedAmount: 5, refundKind: 'refunded',
}

/** Mirrors exportData: the store slices go out whole, then importData parses them back. */
const exported = () =>
  JSON.parse(
    JSON.stringify({
      profile,
      incomeSources: [incomeSource],
      debts: [debt],
      savingsAccounts: [savingsAccount],
      savingsTransactions: [savingsTx],
      expenses: [expense],
    })
  )

describe('import schema round trip', () => {
  it('keeps every field an export writes, so a restore cannot wipe it on the server', () => {
    const data = importDataSchema.parse(exported())
    expect(data.profile).toEqual(profile)
    expect(data.incomeSources).toEqual([incomeSource])
    expect(data.debts).toEqual([debt])
    expect(data.savingsAccounts).toEqual([savingsAccount])
    expect(data.savingsTransactions).toEqual([savingsTx])
    expect(data.expenses).toEqual([expense])
  })

  it('keeps a field the schema does not list yet', () => {
    const file = exported()
    file.debts[0].someFutureField = { nested: [1, 2] }
    expect(importDataSchema.parse(file).debts?.[0]).toMatchObject({ someFutureField: { nested: [1, 2] } })
  })

  it('still checks the known fields', () => {
    const file = exported()
    file.debts[0].installmentItemType = 'yacht'
    expect(importDataSchema.safeParse(file).success).toBe(false)
  })

  it('accepts a legacy profile that still carries baseCurrency and drops it', () => {
    const file = exported()
    file.profile.baseCurrency = 'EGP'
    expect(importDataSchema.parse(file).profile).toEqual(profile)
  })

  it('leaves the server-owned SMS key and row version out', () => {
    const file = exported()
    Object.assign(file.expenses[0], { smsLogId: 'log1', serverRev: 3 })
    expect(importDataSchema.parse(file).expenses?.[0]).toEqual(expense)
  })

  it('does not let a file add keys to the store', () => {
    const file = { ...exported(), user: { id: 'other' } }
    expect('user' in importDataSchema.parse(file)).toBe(false)
  })
})
