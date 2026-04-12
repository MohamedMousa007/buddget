import { z } from 'zod'

const currencySchema = z.enum(['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR', 'XAU'])
const fiatCurrencySchema = z.enum(['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR'])

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
      baseCurrency: currencySchema,
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
      dismissOnboardingBanner: z.boolean().optional(),
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
        sharedPlanId: z.string().uuid().nullable().optional(),
      })
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
        recurringId: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
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
        emoji: z.string(),
        targetAmount: z.number().optional(),
        currency: fiatCurrencySchema,
        currentBalance: z.number(),
        createdAt: z.string(),
        notes: z.string().optional(),
        autoSave: z
          .object({
            enabled: z.boolean(),
            mode: z.enum(['fixed_schedule', 'end_of_month', 'percent_of_income']),
            amount: z.number().optional(),
            frequency: z.enum(['weekly', 'monthly']).optional(),
            dayOfMonth: z.number().optional(),
            weekday: z.number().optional(),
            percent: z.number().optional(),
            lastRunKey: z.string().optional(),
          })
          .optional(),
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
        currency: fiatCurrencySchema,
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
        debtType: z.enum(['personal', 'installment', 'general']).optional(),
        personName: z.string().optional(),
        relationship: z.string().optional(),
        direction: z.enum(['i_owe', 'they_owe']).optional(),
        installmentCount: z.number().optional(),
        installmentFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'annually']).optional(),
        installmentAmount: z.number().optional(),
        startDate: z.string().optional(),
        interestFree: z.boolean().optional(),
        creditor: z.string().optional(),
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
  onboardingState: z
    .object({
      flowVersion: z.number(),
      answers: z.record(z.string(), z.unknown()),
      currentStepIndex: z.number(),
      planAccepted: z.boolean(),
      selectedPlanIndex: z.number().nullable(),
      aiPlans: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            personaId: z.string(),
            personaLabel: z.string(),
            personaTagline: z.string(),
            rationale: z.string(),
            costOfLivingNote: z.string().optional(),
            percents: z.record(z.string(), z.number()),
            assumptions: z.array(z.string()),
          })
        )
        .nullable(),
      aiGeneratedAt: z.string().nullable(),
      lastValidationNotes: z.array(z.string()).nullable(),
    })
    .optional(),
})
