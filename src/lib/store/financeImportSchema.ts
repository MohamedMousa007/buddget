import { z } from 'zod'
import type { ExpenseCategory } from '@/lib/store/types'

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** A real calendar date (`2026-02-30` is not one), an ISO timestamp, or empty for "no date". Anything else would crash date formatting later. */
function isDateText(value: string): boolean {
  if (value === '') return true
  const m = DATE_ONLY.exec(value)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const t = new Date(Date.UTC(y, mo - 1, d))
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
  }
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))
}

const dateText = z.string().refine(isDateText, 'Expected a date (YYYY-MM-DD) or an ISO timestamp')


const GCC_FIATS = [
  'KWD',
  'QAR',
  'BHD',
  'OMR',
  'MAD',
  'TND',
  'JOD',
] as const

const currencySchema = z.enum([
  'AED',
  'USD',
  'EGP',
  'EUR',
  'GBP',
  'SAR',
  ...GCC_FIATS,
  'XAU',
])
const fiatCurrencySchema = z.enum(['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR', ...GCC_FIATS])
const savingsCurrencySchema = z.enum([
  'AED',
  'USD',
  'EGP',
  'EUR',
  'GBP',
  'SAR',
  ...GCC_FIATS,
  'XAU',
  'USDT',
  'USDC',
  'BTC',
  'ETH',
])
const savingsTypeSchema = z.enum([
  'bank',
  'cash',
  'gold',
  'stablecoin',
  'crypto_stable',
  'crypto',
  'stocks',
  'real_estate',
  'other',
])

const paymentMethodTypeSchema = z.enum([
  'cash',
  'bank_account',
  'debit_card',
  'credit_card',
  'prepaid_card',
  'wallet',
  'bnpl',
  'other',
])

/** Validates JSON passed to `importData` in the finance store. */
export const importDataSchema = z.object({
  profile: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string().optional(),
      avatar: z.string().optional(),
      avatarPresetId: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      phone: z.string().optional(),
      gender: z.enum(['male', 'female', 'prefer_not_to_say']).nullable().optional(),
      baseCurrency: currencySchema,
      household: z.enum(['solo', 'couple', 'family']).nullable().optional(),
      lifestyleTier: z.enum(['minimal', 'balanced', 'comfortable']).nullable().optional(),
      foodFrequency: z.enum(['everyday', 'mostdays', 'sometimes', 'rarely']).nullable().optional(),
      transportMode: z.enum(['public', 'car', 'taxi', 'walk']).nullable().optional(),
      monthlyRent: z.number().nullable().optional(),
      rentIncludesUtilities: z.boolean().optional(),
      createdAt: dateText,
    })
    .optional(),
  settings: z
    .object({
      baseCurrency: fiatCurrencySchema,
      secondaryCurrency: fiatCurrencySchema.nullable().optional(),
      showSecondaryCurrency: z.boolean().optional(),
      theme: z.enum(['dark', 'light', 'system']),
      language: z.enum(['en', 'ar']),
      showCentsInDashboard: z.boolean(),
      monthStartDay: z.number().int().min(1).max(28),
      budgetEntryMode: z.enum(['amount', 'percent_of_income']).optional(),
      enableAI: z.boolean().optional(),
      aiProvider: z.enum(['gemini']).optional(),
      noIncomeDeclared: z.boolean().optional(),
      showAllCurrenciesInForms: z.boolean().optional(),
      twoFactorEmailEnabled: z.boolean().optional(),
      legacyOnboardingMigratedAt: dateText.nullable().optional(),
      dashboardLayout: z.enum(['standard', 'minimal']).optional(),
      weekStartDay: z.union([z.literal(0), z.literal(1), z.literal(6)]).optional(),
      wealthGoldStrip: z.enum(['collapsed', 'expanded', 'hidden']).optional(),
      promptState: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  incomeSources: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        amount: z.number(),
        currency: fiatCurrencySchema,
        isRecurring: z.boolean(),
        recurringFrequency: z.enum(['monthly', 'biweekly', 'weekly']).optional(),
        dayOfMonth: z.number().int().min(1).max(31).optional(),
        notes: z.string().optional(),
        createdAt: dateText,
        updatedAt: dateText.optional(),
        effectiveStart: dateText.optional(),
        effectiveEnd: dateText.nullable().optional(),
        sharedPlanId: z.string().uuid().nullable().optional(),
        sourceType: z
          .enum([
            'salary',
            'bonus',
            'side_hustle',
            'investment',
            'savings',
            'debt',
            'gift',
            'refund',
            'other',
          ])
          .optional(),
        linkedSavingsAccountId: z.string().optional(),
        linkedDebtId: z.string().optional(),
        paymentMethodId: z.string().optional(),
      })
        // Legacy backups predate updatedAt/effectiveStart; backfill from createdAt.
        .transform((o) => ({
          ...o,
          updatedAt: o.updatedAt ?? o.createdAt,
          effectiveStart: o.effectiveStart ?? o.createdAt.slice(0, 10),
        }))
    )
    .optional(),
  incomeEvents: z
    .array(
      z.object({
        id: z.string(),
        occurredAt: dateText.optional(),
        templateId: z.string().nullable().optional(),
        name: z.string(),
        amount: z.number(),
        currency: fiatCurrencySchema,
        sourceType: z
          .enum([
            'salary',
            'bonus',
            'side_hustle',
            'investment',
            'savings',
            'debt',
            'gift',
            'refund',
            'other',
          ])
          .optional(),
        receivedDate: dateText,
        status: z.enum(['confirmed', 'projected', 'late', 'missed', 'partial']),
        paymentMethodId: z.string().optional(),
        linkedSavingsAccountId: z.string().optional(),
        linkedDebtId: z.string().optional(),
        sharedPlanId: z.string().uuid().nullable().optional(),
        smsLogId: z.string().nullable().optional(),
        notes: z.string().optional(),
        createdAt: dateText,
        updatedAt: dateText.optional(),
      })
        // smsLogId is dropped on import: a restore into the same account would hit the unique booking index (23505).
        .transform(({ smsLogId: _smsLogId, ...o }) => ({ ...o, updatedAt: o.updatedAt ?? o.createdAt }))
    )
    .optional(),
  expenses: z
    .array(
      z.object({
        id: z.string(),
        occurredAt: dateText.optional(),
        toPaymentMethodId: z.string().optional(),
        spendExclusion: z.enum(['method', 'manual', 'for_someone']).optional(),
        owedBy: z.string().optional(),
        owedSettledAt: dateText.optional(),
        date: dateText,
        description: z.string(),
        category: z.string(),
        subcategory: z.string().optional(),
        amount: z.number(),
        currency: fiatCurrencySchema,
        amountInBaseCurrency: z.number(),
        paymentMethodId: z.string(),
        isRecurring: z.boolean(),
        notes: z.string().optional(),
        createdAt: dateText,
        updatedAt: dateText,
        sharedPlanId: z.string().uuid().nullable().optional(),
        linkedDebtId: z.string().optional(),
        isDebtPayment: z.boolean().optional(),
      })
    )
    .optional(),
  recurringExpenses: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        category: z.string(),
        subcategory: z.string().optional(),
        amount: z.number(),
        currency: currencySchema.exclude(['XAU']),
        paymentMethodId: z.string(),
        dayOfMonth: z.number().int().min(1).max(31),
        isActive: z.boolean(),
        notes: z.string().optional(),
        sharedPlanId: z.string().uuid().nullable().optional(),
      })
    )
    .optional(),
  budgetCategories: z
    .array(
      z.object({
        category: z.string(),
        budgetedAmount: z.number(),
        currency: fiatCurrencySchema,
        percentOfIncome: z.number().min(0).max(100).nullable().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  budgetPlanActivations: z
    .array(z.object({ id: z.string(), planId: z.string(), effectiveFrom: dateText, createdAt: dateText }))
    .optional(),
  accountAdjustments: z
    .array(
      z.object({
        id: z.string(),
        paymentMethodId: z.string(),
        delta: z.number(),
        reason: z.enum(['manual_update', 'gap', 'opening_correction']),
        occurredAt: dateText,
        note: z.string().optional(),
        createdAt: dateText,
        updatedAt: dateText,
      }),
    )
    .optional(),
  buddgyMemories: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().max(280),
        kind: z.enum(['fact', 'preference', 'constraint']),
        source: z.enum(['budget', 'chat', 'settings']),
        status: z.enum(['proposed', 'active']),
        createdAt: dateText,
        updatedAt: dateText,
      }),
    )
    .max(40)
    .optional(),
  budgetPlans: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        createdAt: dateText,
        updatedAt: dateText.optional(),
        household: z.enum(['solo', 'partner', 'family']).nullable().optional(),
        buddgyGuidedComplete: z.boolean().optional(),
        status: z.enum(['draft', 'ready', 'archived']).optional(),
        intent: z.enum(['balanced', 'saver', 'debt_crusher', 'custom']).optional(),
        origin: z.enum(['ai', 'manual', 'template', 'clone']).optional(),
        incomeOverride: z.number().min(0).nullable().optional(),
        rationale: z.object({ reasons: z.array(z.string()), risks: z.array(z.string()).optional() }).nullable().optional(),
        engineVersion: z.string().nullable().optional(),
        buddgyFlow: z
          .object({
            rentIncludesUtilities: z.boolean().optional(),
            dewaMonthly: z.number().optional(),
            transportMode: z.enum(['car', 'public', 'walk', 'mix']).optional(),
            transportCarMonthly: z.number().optional(),
            transportPublicDaily: z.number().optional(),
            savingsPercent: z.number().optional(),
            aiFillAccepted: z.boolean().optional(),
            flowFinished: z.boolean().optional(),
            aiSuggestions: z
              .array(
                z.object({
                  name: z.string(),
                  emoji: z.string(),
                  amount: z.number(),
                  currency: fiatCurrencySchema,
                })
              )
              .optional(),
          })
          .nullable()
          .optional(),
        categories: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            icon: z.string(),
            amount: z.number(),
            currency: fiatCurrencySchema.optional(),
            isSavings: z.boolean().optional(),
            block: z.enum(['bills', 'subscriptions', 'debts', 'everyday', 'safety', 'goals', 'grow']).optional(),
            linkType: z.enum(['none', 'subscriptions', 'debts', 'goal', 'emergency']).optional(),
            linkIds: z.array(z.string()).optional(),
            dueDay: z.number().int().min(1).max(31).nullable().optional(),
            essential: z.boolean().optional(),
            locked: z.boolean().optional(),
            rationale: z.string().nullable().optional(),
            confidence: z.enum(['high', 'estimated']).nullable().optional(),
            expenseCategories: z.array(z.string()).optional(),
            subcategories: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                amount: z.number(),
                icon: z.string().optional(),
              })
            ),
          })
        ),
      })
    )
    .optional(),
  activeBudgetPlanId: z.string().nullable().optional(),
  savingsHoldings: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        bucket: z.enum(['liquid', 'investment']),
        subtype: z.enum(['bank', 'cash', 'gold', 'stocks', 'crypto', 'real_estate', 'other']),
        amount: z.number(),
        currency: fiatCurrencySchema,
        notes: z.string().optional(),
        asOfDate: dateText.optional(),
        createdAt: dateText,
        updatedAt: dateText,
      })
    )
    .optional(),
  savingsAccounts: z
    .array(
      z.object({
        id: z.string(),
        heldInPaymentMethodId: z.string().optional(),
        name: z.string(),
        category: z.enum(['savings', 'investment']).optional(),
        type: savingsTypeSchema.optional(),
        icon: z.string().optional(),
        emoji: z.string().optional(),
        targetAmount: z.number().optional(),
        currency: savingsCurrencySchema,
        currentBalance: z.number(),
        createdAt: dateText,
        notes: z.string().optional(),
        autoSave: z.unknown().optional(),
      })
    )
    .optional(),
  recurringSavingsDeposits: z
    .array(
      z.object({
        id: z.string(),
        accountId: z.string(),
        amount: z.number(),
        currency: savingsCurrencySchema,
        frequency: z.literal('monthly'),
        dayOfMonth: z.number().int().min(1).max(28),
        nextDueDate: dateText,
        isActive: z.boolean(),
        notes: z.string().optional(),
        createdAt: dateText,
      })
    )
    .optional(),
  savingsTransactions: z
    .array(
      z.object({
        id: z.string(),
        occurredAt: dateText.optional(),
        paymentMethodId: z.string().optional(),
        accountId: z.string(),
        type: z.enum(['deposit', 'withdrawal']),
        amount: z.number(),
        currency: savingsCurrencySchema,
        date: dateText,
        source: z.string().optional(),
        notes: z.string().optional(),
        isAutoSave: z.boolean().optional(),
      })
    )
    .optional(),
  paymentMethods: z
    .array(
      z.object({
        id: z.string(),
        parentId: z.string().optional(),
        openingBalance: z.number().optional(),
        openingAt: dateText.optional(),
        closedAt: dateText.optional(),
        trackSms: z.boolean().optional(),
        excluded: z.boolean().optional(),
        name: z.string(),
        type: paymentMethodTypeSchema,
        currency: fiatCurrencySchema,
        color: z.string().optional(),
        icon: z.string().optional(),
        last4: z.string().optional(),
        label: z.string().max(24).optional(),
        isDefault: z.boolean(),
      })
    )
    .optional(),
  debts: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        person: z.string(),
        startingBalance: z.number(),
        currency: currencySchema,
        isGold: z.boolean(),
        goldKarat: z.union([z.literal(24), z.literal(22), z.literal(21), z.literal(18)]).optional(),
        description: z.string().optional(),
        notes: z.string().optional(),
        sharedPlanId: z.string().uuid().nullable().optional(),
        createdAt: dateText,
        status: z.enum(['active', 'cleared']).optional(),
        clearedAt: dateText.optional(),
        emoji: z.string().optional(),
        debtType: z.enum(['personal', 'installment', 'general', 'credit_card']).optional(),
        creditLimit: z.number().optional(),
        paymentDueDay: z.number().optional(),
        gracePeriodDays: z.number().optional(),
        linkedPaymentMethodId: z.string().optional(),
        minimumPaymentPercent: z.number().optional(),
        installmentProvider: z.enum(['credit_card', 'tabby', 'tamara', 'other']).optional(),
        linkedCreditCardDebtId: z.string().optional(),
        personName: z.string().optional(),
        relationship: z.string().optional(),
        direction: z.enum(['i_owe', 'they_owe']).optional(),
        installmentCount: z.number().optional(),
        installmentFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'annually']).optional(),
        installmentAmount: z.number().optional(),
        startDate: dateText.optional(),
        interestFree: z.boolean().optional(),
        creditor: z.string().optional(),
        receivedVia: z
          .enum(['cash', 'bank_transfer', 'card', 'crypto', 'gold', 'other'])
          .optional(),
        goal: z
          .object({
            targetDate: dateText,
            paymentFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'annually']),
            calculatedAmount: z.number(),
          })
          .optional(),
      })
    )
    .optional(),
  debtPayments: z
    .array(
      z.object({
        id: z.string(),
        occurredAt: dateText.optional(),
        debtId: z.string(),
        date: dateText,
        amountPaid: z.number(),
        paymentCurrency: z.string().optional(),
        originalAmount: z.number().optional(),
        amountInPrimary: z.number().optional(),
        rateAtEntry: z.number().optional(),
        notes: z.string().optional(),
        sharedPlanId: z.string().uuid().nullable().optional(),
        createdAt: dateText,
      })
    )
    .optional(),
  recurringDebtPayments: z
    .array(
      z.object({
        id: z.string(),
        debtId: z.string(),
        amount: z.number(),
        currency: currencySchema,
        paymentMethodId: z.string(),
        frequency: z.enum(['monthly', 'biweekly', 'weekly', 'quarterly', 'annually']),
        nextDueDate: dateText,
        isActive: z.boolean(),
        notes: z.string().optional(),
        createdAt: dateText,
      })
    )
    .optional(),
  financialGoalsNotes: z.string().optional(),
  subscriptions: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        brandKey: z.string().nullable(),
        planName: z.string().nullable(),
        planId: z.string().nullable().default(null),
        catalogRegion: z.string().nullable().default(null),
        pendingPlanId: z.string().nullable().default(null),
        pendingAmount: z.number().nullable().default(null),
        amount: z.number(),
        currency: fiatCurrencySchema,
        billingCycle: z.enum(['monthly', 'quarterly', 'semiannual', 'yearly', 'weekly']),
        billingDay: z.number().int().min(1).max(31),
        startDate: dateText,
        nextBillingDate: dateText.nullable(),
        paymentMethodId: z.string().nullable(),
        expenseCategory: z.string(),
        linkedRecurringExpenseId: z.string().nullable(),
        status: z.enum(['active', 'cancelled', 'paused', 'trial']),
        notes: z.string().nullable(),
        createdAt: dateText,
        cancelledAt: dateText.nullable(),
        updatedAt: dateText.optional(),
        tracking: z.enum(['sms', 'ask', 'log']).optional(),
        reminder: z.boolean().optional(),
        trialEnd: dateText.nullable().optional(),
        endsOn: dateText.nullable().optional(),
        pausedAt: dateText.nullable().optional(),
        priceHistory: z.array(z.object({ amount: z.number(), from: z.string() })).optional(),
        pendingPlanFrom: dateText.nullable().optional(),
        sharedWith: z.array(z.string()).nullable().optional(),
        myShare: z.number().nullable().optional(),
      })
    )
    .optional(),
  goals: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        emoji: z.string(),
        category: z.enum([
          'emergency_fund',
          'house',
          'car',
          'vacation',
          'education',
          'wedding',
          'phone_device',
          'family_support',
          'sadaqah_charity',
          'gift',
          'investment',
          'debt_freedom',
          'quality_of_life',
          'business',
          'spending_control',
          'retirement',
          'custom',
        ]),
        targetAmount: z.number().nullable(),
        currency: savingsCurrencySchema,
        manualCurrentAmount: z.number(),
        targetDate: dateText.nullable(),
        linkedSavingsAccountIds: z.array(z.string()),
        linkedDebtIds: z.array(z.string()),
        monthlySpendingLimit: z.number().nullable(),
        spendingCategory: z.custom<ExpenseCategory>((v) => v == null || typeof v === 'string').nullable().optional(),
        priority: z.number(),
        status: z.enum(['active', 'achieved', 'paused', 'cancelled']),
        monthlyContribution: z.number().nullable(),
        fundingMode: z.enum(['share', 'fixed', 'manual']).optional(),
        sharePct: z.number().nullable().optional(),
        frequency: z.enum(['monthly', 'quarterly']).optional(),
        planStart: dateText.nullable().optional(),
        notes: z.string().nullable(),
        createdAt: dateText,
        achievedAt: dateText.nullable(),
      })
    )
    .optional(),
})
