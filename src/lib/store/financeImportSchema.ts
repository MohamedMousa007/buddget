import { z } from 'zod'

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
  'bank_transfer',
  'card_debit',
  'card_credit',
  'nol',
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
      createdAt: z.string(),
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
      legacyOnboardingMigratedAt: z.string().nullable().optional(),
      dashboardLayout: z.enum(['standard', 'minimal']).optional(),
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
        createdAt: z.string(),
        updatedAt: z.string().optional(),
        effectiveStart: z.string().optional(),
        effectiveEnd: z.string().nullable().optional(),
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
        receivedDate: z.string(),
        status: z.enum(['confirmed', 'projected', 'late', 'missed', 'partial']),
        paymentMethodId: z.string().optional(),
        linkedSavingsAccountId: z.string().optional(),
        linkedDebtId: z.string().optional(),
        sharedPlanId: z.string().uuid().nullable().optional(),
        smsLogId: z.string().nullable().optional(),
        notes: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string().optional(),
      })
        .transform((o) => ({ ...o, updatedAt: o.updatedAt ?? o.createdAt }))
    )
    .optional(),
  expenses: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        description: z.string(),
        category: z.string(),
        subcategory: z.string().optional(),
        amount: z.number(),
        currency: fiatCurrencySchema,
        amountInBaseCurrency: z.number(),
        paymentMethodId: z.string(),
        isRecurring: z.boolean(),
        notes: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
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
  budgetPlans: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        createdAt: z.string(),
        updatedAt: z.string().optional(),
        household: z.enum(['solo', 'partner', 'family']).nullable().optional(),
        buddgyGuidedComplete: z.boolean().optional(),
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
        asOfDate: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
    )
    .optional(),
  savingsAccounts: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.enum(['savings', 'investment']).optional(),
        type: savingsTypeSchema.optional(),
        icon: z.string().optional(),
        emoji: z.string().optional(),
        targetAmount: z.number().optional(),
        currency: savingsCurrencySchema,
        currentBalance: z.number(),
        createdAt: z.string(),
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
        nextDueDate: z.string(),
        isActive: z.boolean(),
        notes: z.string().optional(),
        createdAt: z.string(),
      })
    )
    .optional(),
  savingsTransactions: z
    .array(
      z.object({
        id: z.string(),
        accountId: z.string(),
        type: z.enum(['deposit', 'withdrawal']),
        amount: z.number(),
        currency: savingsCurrencySchema,
        date: z.string(),
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
        name: z.string(),
        type: paymentMethodTypeSchema,
        currency: fiatCurrencySchema,
        color: z.string().optional(),
        icon: z.string().optional(),
        last4: z.string().optional(),
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
        createdAt: z.string(),
        status: z.enum(['active', 'cleared']).optional(),
        clearedAt: z.string().optional(),
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
        startDate: z.string().optional(),
        interestFree: z.boolean().optional(),
        creditor: z.string().optional(),
        receivedVia: z
          .enum(['cash', 'bank_transfer', 'card', 'crypto', 'gold', 'other'])
          .optional(),
        goal: z
          .object({
            targetDate: z.string(),
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
        debtId: z.string(),
        date: z.string(),
        amountPaid: z.number(),
        paymentCurrency: z.string().optional(),
        originalAmount: z.number().optional(),
        amountInPrimary: z.number().optional(),
        rateAtEntry: z.number().optional(),
        notes: z.string().optional(),
        sharedPlanId: z.string().uuid().nullable().optional(),
        createdAt: z.string(),
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
        nextDueDate: z.string(),
        isActive: z.boolean(),
        notes: z.string().optional(),
        createdAt: z.string(),
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
        amount: z.number(),
        currency: fiatCurrencySchema,
        billingCycle: z.enum(['monthly', 'quarterly', 'yearly', 'weekly']),
        billingDay: z.number().int().min(1).max(31),
        startDate: z.string(),
        nextBillingDate: z.string().nullable(),
        paymentMethodId: z.string().nullable(),
        expenseCategory: z.string(),
        linkedRecurringExpenseId: z.string().nullable(),
        status: z.enum(['active', 'cancelled', 'paused', 'trial']),
        notes: z.string().nullable(),
        createdAt: z.string(),
        cancelledAt: z.string().nullable(),
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
          'spending_control',
          'retirement',
          'custom',
        ]),
        targetAmount: z.number().nullable(),
        currency: savingsCurrencySchema,
        manualCurrentAmount: z.number(),
        targetDate: z.string().nullable(),
        linkedSavingsAccountIds: z.array(z.string()),
        linkedDebtIds: z.array(z.string()),
        monthlySpendingLimit: z.number().nullable(),
        priority: z.number(),
        status: z.enum(['active', 'achieved', 'paused', 'cancelled']),
        monthlyContribution: z.number().nullable(),
        notes: z.string().nullable(),
        createdAt: z.string(),
        achievedAt: z.string().nullable(),
      })
    )
    .optional(),
})
