import { describe, expect, it } from 'vitest'
import type {
  Debt,
  DebtPayment,
  Expense,
  Goal,
  IncomeSource,
  PaymentMethod,
  RecurringDebtPayment,
  RecurringExpense,
  RecurringSavingsDeposit,
  SavingsAccount,
  SavingsHolding,
  SavingsTransaction,
  Subscription,
  UserProfile,
} from '@/lib/store/types'

import { profileFromRow, profileToRow } from '@/lib/supabase/remote/mappers/profileMapper'
import { settingsFromRow, settingsToRow } from '@/lib/supabase/remote/mappers/settingsMapper'
import { onboardingFromRow, onboardingToRow } from '@/lib/supabase/remote/mappers/onboardingMapper'
import { paymentMethodFromRow, paymentMethodToRow } from '@/lib/supabase/remote/mappers/paymentMethodMapper'
import { incomeSourceFromRow, incomeSourceToRow } from '@/lib/supabase/remote/mappers/incomeSourceMapper'
import { expenseFromRow, expenseToRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { recurringExpenseFromRow, recurringExpenseToRow } from '@/lib/supabase/remote/mappers/recurringExpenseMapper'
import { subscriptionFromRow, subscriptionToRow } from '@/lib/supabase/remote/mappers/subscriptionMapper'
import { debtFromRow, debtToRow } from '@/lib/supabase/remote/mappers/debtMapper'
import { debtPaymentFromRow, debtPaymentToRow } from '@/lib/supabase/remote/mappers/debtPaymentMapper'
import { recurringDebtPaymentFromRow, recurringDebtPaymentToRow } from '@/lib/supabase/remote/mappers/recurringDebtPaymentMapper'
import { savingsAccountFromRow, savingsAccountToRow } from '@/lib/supabase/remote/mappers/savingsAccountMapper'
import { savingsHoldingFromRow, savingsHoldingToRow } from '@/lib/supabase/remote/mappers/savingsHoldingMapper'
import { savingsTransactionFromRow, savingsTransactionToRow } from '@/lib/supabase/remote/mappers/savingsTransactionMapper'
import { recurringSavingsDepositFromRow, recurringSavingsDepositToRow } from '@/lib/supabase/remote/mappers/recurringSavingsDepositMapper'
import { goalFromRow, goalToRow } from '@/lib/supabase/remote/mappers/goalMapper'

import { deepEqual, diffLists, diffSingleton } from '@/lib/supabase/remote/diff'

const UID = '00000000-0000-0000-0000-000000000001'

// Helper: round-trip from domain → row → domain. `Row` uses `unknown` so each
// mapper's Insert type (with its optional fields) accepts the cast cleanly.
function roundTrip<Domain>(
  x: Domain,
  toRow: (x: Domain, userId: string) => unknown,
  fromRow: (r: never) => Domain
): Domain {
  const row = toRow(x, UID) as Record<string, unknown>
  return fromRow({ ...row, updated_at: new Date().toISOString() } as never)
}

describe('deepEqual', () => {
  it('handles primitives, arrays, and nested objects', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false)
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
  })
})

describe('diffLists', () => {
  it('detects inserts, updates, and deletes by id', () => {
    const prev = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ]
    const next = [
      { id: 'a', n: 1 }, // unchanged
      { id: 'b', n: 99 }, // updated
      { id: 'd', n: 4 }, // inserted
    ] // 'c' missing → deleted
    const diff = diffLists(next, prev)
    expect(diff.inserts).toEqual([{ id: 'd', n: 4 }])
    expect(diff.updates).toEqual([{ id: 'b', n: 99 }])
    expect(diff.deletes).toEqual(['c'])
  })
})

describe('diffSingleton', () => {
  it('returns new value when changed, null when equal, next on first write', () => {
    expect(diffSingleton({ a: 1 }, null)).toEqual({ a: 1 })
    expect(diffSingleton({ a: 1 }, { a: 1 })).toBeNull()
    expect(diffSingleton({ a: 2 }, { a: 1 })).toEqual({ a: 2 })
  })
})

describe('profile mapper', () => {
  it('round-trips core identity fields', () => {
    const p: UserProfile = {
      id: 'local',
      name: 'Alice',
      email: 'a@b.com',
      phone: '+1',
      city: 'Cairo',
      country: 'Egypt',
      baseCurrency: 'EGP',
      createdAt: '2026-04-01T00:00:00.000Z',
      avatar: 'https://…/x.png',
      avatarPresetId: 'toon_a',
    }
    const row = profileToRow(p, { financialGoalsNotes: 'save more', activeBudgetPlanId: null }, UID)
    expect(row.id).toBe(UID)
    expect(row.base_currency).toBe('EGP')
    expect(row.city).toBe('Cairo')
    expect(row.avatar_image_path).toBe('https://…/x.png')
    const back = profileFromRow({ ...row, updated_at: row.created_at ?? '' } as never)
    expect(back.profile.baseCurrency).toBe('EGP')
    expect(back.profile.city).toBe('Cairo')
    expect(back.extras.financialGoalsNotes).toBe('save more')
  })

  it.each<UserProfile['gender']>(['male', 'female', 'prefer_not_to_say', null])(
    'round-trips gender %s',
    (gender) => {
      const p: UserProfile = {
        id: 'local',
        name: 'Alice',
        baseCurrency: 'EGP',
        createdAt: '2026-04-01T00:00:00.000Z',
        gender,
      }
      const row = profileToRow(p, { financialGoalsNotes: '', activeBudgetPlanId: null }, UID)
      expect(row.gender).toBe(gender ?? null)
      const back = profileFromRow({ ...row, updated_at: row.created_at ?? '' } as never)
      expect(back.profile.gender).toBe(gender ?? null)
    }
  )
})

describe('settings mapper', () => {
  it('round-trips preferences and handles system theme → dark mapping', () => {
    const s = {
      baseCurrency: 'EGP' as const,
      secondaryCurrency: 'USD' as const,
      showSecondaryCurrency: true,
      theme: 'dark' as const,
      language: 'en' as const,
      showCentsInDashboard: true,
      monthStartDay: 1,
      budgetEntryMode: 'amount' as const,
      enableAI: false,
      aiProvider: 'gemini' as const,
      noIncomeDeclared: false,
      showAllCurrenciesInForms: true,
      dismissOnboardingBanner: false,
      onboardingBannerRemindAt: null,
      twoFactorEmailEnabled: false,
    }
    const row = settingsToRow(s, UID)
    const back = settingsFromRow({ ...row, updated_at: '' } as never, {
      baseCurrency: 'EGP',
      secondaryCurrency: 'USD',
    })
    expect(back).toEqual(s)
  })
})

describe('onboarding mapper', () => {
  it('round-trips answers + step index, drops deprecated fields', () => {
    const o = {
      flowVersion: 2,
      answers: { country: 'Egypt', foo: ['bar'] },
      currentStepIndex: 5,
      planAccepted: true,
      selectedPlanIndex: null,
      aiPlans: null,
      aiGeneratedAt: null,
      lastValidationNotes: null,
    }
    const row = onboardingToRow(o, UID)
    const back = onboardingFromRow({ ...row, updated_at: '' } as never)
    expect(back.currentStepIndex).toBe(5)
    expect(back.planAccepted).toBe(true)
    expect(back.answers).toEqual(o.answers)
  })
})

describe('payment method mapper', () => {
  it('round-trips', () => {
    const pm: PaymentMethod = {
      id: 'pm_default_cash',
      name: 'Cash',
      type: 'cash',
      currency: 'EGP',
      color: '#A3A3A3',
      isDefault: true,
    }
    const back = roundTrip(pm, paymentMethodToRow, paymentMethodFromRow)
    expect(back.id).toBe(pm.id)
    expect(back.type).toBe(pm.type)
    expect(back.currency).toBe(pm.currency)
    expect(back.isDefault).toBe(pm.isDefault)
  })
})

describe('income source mapper', () => {
  it('round-trips a monthly salary', () => {
    const i: IncomeSource = {
      id: 'inc_1',
      name: 'Salary',
      amount: 10000,
      currency: 'EGP',
      isRecurring: true,
      recurringFrequency: 'monthly',
      dayOfMonth: 25,
      notes: 'gross',
      createdAt: '2026-04-01T00:00:00.000Z',
      sourceType: 'salary',
    }
    const back = roundTrip(i, incomeSourceToRow, incomeSourceFromRow)
    expect(back.amount).toBe(10000)
    expect(back.recurringFrequency).toBe('monthly')
    expect(back.sourceType).toBe('salary')
  })
  it('maps legacy side_hustle → freelance', () => {
    const i: IncomeSource = {
      id: 'inc_2', name: 'Freelance', amount: 500, currency: 'USD',
      isRecurring: false, createdAt: '2026-04-01T00:00:00.000Z', sourceType: 'side_hustle',
    }
    const row = incomeSourceToRow(i, UID)
    expect(row.source_type).toBe('freelance')
  })
})

describe('expense mapper', () => {
  it('round-trips and clamps unknown category to Other', () => {
    const e: Expense = {
      id: 'exp_1', date: '2026-04-10', description: 'Lunch', category: 'Food',
      amount: 120, currency: 'EGP', amountInBaseCurrency: 120, paymentMethodId: 'pm_default_cash',
      isRecurring: false, createdAt: '2026-04-10T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z',
    }
    const back = roundTrip(e, expenseToRow, expenseFromRow)
    expect(back.category).toBe('Food')
    expect(back.amount).toBe(120)

    const wonky = { ...e, category: 'not-a-real-cat' }
    const row = expenseToRow(wonky, UID)
    expect(row.category).toBe('Other')
  })
})

describe('recurring expense mapper', () => {
  it('round-trips', () => {
    const r: RecurringExpense = {
      id: 're_1', description: 'Netflix', category: 'Enjoyment',
      amount: 70, currency: 'EGP', paymentMethodId: 'pm', dayOfMonth: 15, isActive: true,
    }
    const back = roundTrip(r, recurringExpenseToRow, recurringExpenseFromRow)
    expect(back.description).toBe('Netflix')
    expect(back.isActive).toBe(true)
  })
})

describe('subscription mapper', () => {
  it('round-trips', () => {
    const s: Subscription = {
      id: 'sub_1', name: 'Netflix', brandKey: 'netflix', planName: 'Basic',
      amount: 70, currency: 'EGP', billingCycle: 'monthly', billingDay: 15,
      startDate: '2026-04-15', nextBillingDate: '2026-05-15', paymentMethodId: null,
      expenseCategory: 'Enjoyment', linkedRecurringExpenseId: 're_1',
      status: 'active', notes: null, createdAt: '2026-04-15T00:00:00.000Z', cancelledAt: null,
    }
    const back = roundTrip(s, subscriptionToRow, subscriptionFromRow)
    expect(back.billingCycle).toBe('monthly')
    expect(back.status).toBe('active')
  })
})

describe('debt mapper', () => {
  it('round-trips a personal debt', () => {
    const d: Debt = {
      id: 'debt_1', name: 'Loan from Sam', person: 'Sam', startingBalance: 5000,
      currency: 'AED', isGold: false, createdAt: '2026-04-01T00:00:00.000Z',
      debtType: 'personal', direction: 'i_owe', interestFree: true,
    }
    const back = roundTrip(d, debtToRow, debtFromRow)
    expect(back.startingBalance).toBe(5000)
    expect(back.debtType).toBe('personal')
    expect(back.direction).toBe('i_owe')
  })
  it('maps gold karat to/from DB string enum', () => {
    const d: Debt = {
      id: 'debt_gold', name: 'Gold', person: '-', startingBalance: 10,
      currency: 'XAU', isGold: true, createdAt: '2026-04-01T00:00:00.000Z',
      goldKarat: 24,
    }
    const row = debtToRow(d, UID)
    expect(row.gold_karat).toBe('24')
    const back = debtFromRow({ ...row, updated_at: '' } as never)
    expect(back.goldKarat).toBe(24)
  })
})

describe('debt payment mapper', () => {
  it('round-trips', () => {
    const p: DebtPayment = {
      id: 'dp_1', debtId: 'debt_1', date: '2026-04-05', amountPaid: 500,
      paymentCurrency: 'AED', createdAt: '2026-04-05T00:00:00.000Z',
    }
    const back = roundTrip(p, debtPaymentToRow, debtPaymentFromRow)
    expect(back.amountPaid).toBe(500)
    expect(back.debtId).toBe('debt_1')
  })
})

describe('recurring debt payment mapper', () => {
  it('round-trips', () => {
    const r: RecurringDebtPayment = {
      id: 'rdp_1', debtId: 'debt_1', amount: 500, currency: 'AED',
      paymentMethodId: 'pm', frequency: 'monthly', nextDueDate: '2026-05-01',
      isActive: true, createdAt: '2026-04-01T00:00:00.000Z',
    }
    const back = roundTrip(r, recurringDebtPaymentToRow, recurringDebtPaymentFromRow)
    expect(back.frequency).toBe('monthly')
    expect(back.amount).toBe(500)
  })
})

describe('savings account mapper', () => {
  it('round-trips and maps stocks → stock', () => {
    const a: SavingsAccount = {
      id: 'sa_1', name: 'QNB', category: 'savings', type: 'bank',
      icon: 'Landmark', currency: 'EGP', currentBalance: 42000,
      createdAt: '2026-03-23T13:25:13.302Z',
    }
    const back = roundTrip(a, savingsAccountToRow, savingsAccountFromRow)
    expect(back.name).toBe('QNB')
    expect(back.currentBalance).toBe(42000)

    const stocks: SavingsAccount = { ...a, id: 'sa_2', type: 'stocks' }
    const row = savingsAccountToRow(stocks, UID)
    expect(row.type).toBe('stock')
    expect(savingsAccountFromRow({ ...row, updated_at: '' } as never).type).toBe('stocks')
  })
})

describe('savings holding mapper', () => {
  it('round-trips', () => {
    const h: SavingsHolding = {
      id: 'sh_1', name: 'Gold bar 100g', bucket: 'liquid', subtype: 'gold',
      amount: 100, currency: 'XAU', createdAt: '2026-03-28T23:43:30.569Z', updatedAt: '2026-03-28T23:43:30.569Z',
    }
    const back = roundTrip(h, savingsHoldingToRow, savingsHoldingFromRow)
    expect(back.amount).toBe(100)
    expect(back.subtype).toBe('gold')
  })
})

describe('savings transaction mapper', () => {
  it('round-trips deposits and withdrawals', () => {
    const dep: SavingsTransaction = {
      id: 'st_dep', accountId: 'sa_1', type: 'deposit', amount: 500, currency: 'EGP',
      date: '2026-04-10',
    }
    const backD = roundTrip(dep, savingsTransactionToRow, savingsTransactionFromRow)
    expect(backD.type).toBe('deposit')

    const w: SavingsTransaction = { ...dep, id: 'st_w', type: 'withdrawal', amount: 200 }
    const backW = roundTrip(w, savingsTransactionToRow, savingsTransactionFromRow)
    expect(backW.type).toBe('withdrawal')
  })
})

describe('recurring savings deposit mapper', () => {
  it('round-trips', () => {
    const r: RecurringSavingsDeposit = {
      id: 'rsd_1', accountId: 'sa_1', amount: 500, currency: 'EGP',
      frequency: 'monthly', dayOfMonth: 1, nextDueDate: '2026-05-01',
      isActive: true, createdAt: '2026-04-01T00:00:00.000Z',
    }
    const back = roundTrip(r, recurringSavingsDepositToRow, recurringSavingsDepositFromRow)
    expect(back.dayOfMonth).toBe(1)
    expect(back.isActive).toBe(true)
  })
})

describe('goal mapper', () => {
  it('round-trips and maps domain → DB categories', () => {
    const g: Goal = {
      id: 'g_1', name: 'New Car', emoji: '🚗', category: 'car',
      targetAmount: 100000, currency: 'AED', manualCurrentAmount: 0,
      targetDate: '2026-07-31', linkedSavingsAccountIds: ['sa_1'], linkedDebtIds: [],
      monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: null,
      notes: null, createdAt: '2026-04-14T18:25:14.839Z', achievedAt: null,
    }
    const back = roundTrip(g, goalToRow, goalFromRow)
    expect(back.targetAmount).toBe(100000)
    expect(back.category).toBe('car')

    const emergency: Goal = { ...g, id: 'g_2', category: 'emergency_fund' }
    const row = goalToRow(emergency, UID)
    expect(row.category).toBe('emergency')
    expect(goalFromRow({ ...row, updated_at: '' } as never).category).toBe('emergency_fund')
  })
})
