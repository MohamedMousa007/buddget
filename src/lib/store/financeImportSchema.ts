import { z } from 'zod'

const currencySchema = z.enum(['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR', 'XAU'])
const fiatCurrencySchema = z.enum(['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR'])
const expenseCategorySchema = z.enum([
  'Rent',
  'Transport',
  'Food',
  'Enjoyment',
  'Savings',
  'Debt',
  'Remittance',
  'Other',
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
      })
    )
    .optional(),
  expenses: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        description: z.string(),
        category: expenseCategorySchema,
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
      })
    )
    .optional(),
  recurringExpenses: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        category: expenseCategorySchema,
        amount: z.number(),
        currency: currencySchema.exclude(['XAU']),
        paymentMethodId: z.string(),
        dayOfMonth: z.number().int().min(1).max(31),
        isActive: z.boolean(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  budgetCategories: z
    .array(
      z.object({
        category: expenseCategorySchema,
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
        categories: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            icon: z.string(),
            amount: z.number(),
            subcategories: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                amount: z.number(),
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
        createdAt: z.string(),
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
        frequency: z.enum(['monthly', 'biweekly', 'weekly']),
        nextDueDate: z.string(),
        isActive: z.boolean(),
        notes: z.string().optional(),
        createdAt: z.string(),
      })
    )
    .optional(),
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
