import { z } from 'zod'
import type { ExpenseCategory } from '@/lib/store/types'

/** A real calendar day ("2026-02-30" is not one), optionally followed by a time. */
const dayString = z.string().refine((v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}, 'Not a valid date')

/** A timestamp the ledger can order by; anything `Date` cannot read would turn balances into NaN. */
const stampString = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Not a valid timestamp')

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

const installmentItemTypeSchema = z.enum(['phone', 'laptop', 'appliance', 'furniture', 'car', 'other'])

/**
 * Validates JSON passed to `importData` in the finance store. Record schemas are loose: a field this file does not
 * list passes through untouched, because importData writes the result over the store and syncs it, so a stripped
 * field would be wiped on the server too. Only the top level strips unknown keys, so a file cannot add store keys.
 */
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
      baseCurrency: currencySchema.optional(),
      household: z.enum(['solo', 'couple', 'family']).nullable().optional(),
      lifestyleTier: z.enum(['minimal', 'balanced', 'comfortable']).nullable().optional(),
      foodFrequency: z.enum(['everyday', 'mostdays', 'sometimes', 'rarely']).nullable().optional(),
      transportMode: z.enum(['public', 'car', 'taxi', 'walk']).nullable().optional(),
      monthlyRent: z.number().nullable().optional(),
      rentIncludesUtilities: z.boolean().optional(),
      defaultCarryPocketId: z.string().nullable().optional(),
      savingsSplit: z.array(z.looseObject({ target_id: z.string(), pct: z.number() })).optional(),
      emergencyFundConfig: z.looseObject({ targetMonths: z.number() }).nullable().optional(),
      zakatConfig: z
        .looseObject({ nisabBasis: z.enum(['silver', 'gold']), holdsForTrading: z.boolean() })
        .nullable()
        .optional(),
      financialProfile: z.looseObject({}).nullable().optional(),
      createdAt: z.string(),
    })
      // Currency lives in settings since store v18; older backups still carry it on the profile.
      .transform(({ baseCurrency: _baseCurrency, ...p }) => p)
    .optional(),
  settings: z
    .object({
      baseCurrency: fiatCurrencySchema,
      secondaryCurrency: fiatCurrencySchema.nullable().optional(),
      showSecondaryCurrency: z.boolean().optional(),
      theme: z.enum(['dark', 'light', 'system']).transform((t) => (t === 'dark' ? 'dark' : 'light') as 'dark' | 'light'),
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
      weekStartDay: z.union([z.literal(0), z.literal(1), z.literal(6)]).optional(),
      wealthGoldStrip: z.enum(['collapsed', 'expanded', 'hidden']).optional(),
      promptState: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  incomeSources: z
    .array(
      z.looseObject({
        id: z.string(),
        name: z.string(),
        amount: z.number(),
        currency: fiatCurrencySchema,
        isRecurring: z.boolean(),
        recurringFrequency: z.enum(['monthly', 'biweekly', 'weekly']).optional(),
        irregular: z.boolean().optional(),
        dayOfMonth: z.number().int().min(1).max(31).optional(),
        paydayDays: z.array(z.number().int().min(1).max(31)).optional(),
        paydayDriftDays: z.number().nullable().optional(),
        icon: z.string().optional(),
        sortOrder: z.number().optional(),
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
      z.looseObject({
        id: z.string(),
        occurredAt: stampString.optional(),
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
        receivedDate: dayString,
        status: z.enum(['confirmed', 'projected', 'late', 'missed', 'partial']),
        paymentMethodId: z.string().optional(),
        accountAmount: z.number().optional(),
        linkedSavingsAccountId: z.string().optional(),
        linkedDebtId: z.string().optional(),
        sharedPlanId: z.string().uuid().nullable().optional(),
        smsLogId: z.string().nullable().optional(),
        exclusion: z.enum(['pass_through', 'own_transfer']).nullable().optional(),
        notes: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string().optional(),
      })
        // smsLogId is dropped on import: a restore into the same account would hit the unique booking index (23505).
        // serverRev is dropped too: echoing a stale row version makes the server keep its values over the restore.
        .transform(({ smsLogId: _smsLogId, serverRev: _serverRev, ...o }) => ({ ...o, updatedAt: o.updatedAt ?? o.createdAt }))
    )
    .optional(),
  expenses: z
    .array(
      z.looseObject({
        id: z.string(),
        occurredAt: stampString.optional(),
        toPaymentMethodId: z.string().optional(),
        accountAmount: z.number().optional(),
        toAccountAmount: z.number().optional(),
        spendExclusion: z.enum(['method', 'manual', 'for_someone']).optional(),
        categorySource: z.enum(['ai_suggested', 'user_confirmed', 'user_changed']).optional(),
        owedBy: z.string().optional(),
        owedSettledAt: z.string().optional(),
        date: dayString,
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
        // Same as income events: the SMS booking key and the server row version stay with the server.
        .transform(({ smsLogId: _smsLogId, serverRev: _serverRev, ...o }) => o)
    )
    .optional(),
  recurringExpenses: z
    .array(
      z.looseObject({
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
      z.looseObject({
        category: z.string(),
        budgetedAmount: z.number(),
        currency: fiatCurrencySchema,
        percentOfIncome: z.number().min(0).max(100).nullable().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  budgetPlanActivations: z
    .array(z.looseObject({ id: z.string(), planId: z.string(), effectiveFrom: dayString, createdAt: z.string() }))
    .optional(),
  receipts: z.array(z.looseObject({ id: z.string() })).optional(),
  investmentHoldings: z.array(z.looseObject({ id: z.string() })).optional(),
  accountAdjustments: z
    .array(
      z.looseObject({
        id: z.string(),
        paymentMethodId: z.string(),
        delta: z.number(),
        reason: z.enum(['manual_update', 'gap', 'opening_correction']),
        occurredAt: stampString,
        anchorBalance: z.number().optional(),
        note: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .optional(),
  buddgyMemories: z
    .array(
      z.looseObject({
        id: z.string(),
        text: z.string().max(280),
        kind: z.enum(['fact', 'preference', 'constraint']),
        source: z.enum(['budget', 'chat', 'settings']),
        status: z.enum(['proposed', 'active']),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .max(40)
    .optional(),
  budgetPlans: z
    .array(
      z.looseObject({
        id: z.string(),
        name: z.string(),
        createdAt: z.string(),
        updatedAt: z.string().optional(),
        household: z.enum(['solo', 'partner', 'family']).nullable().optional(),
        buddgyGuidedComplete: z.boolean().optional(),
        status: z.enum(['draft', 'ready', 'archived']).optional(),
        intent: z.enum(['balanced', 'saver', 'debt_crusher', 'custom']).optional(),
        origin: z.enum(['ai', 'manual', 'template', 'clone']).optional(),
        incomeOverride: z.number().min(0).nullable().optional(),
        rationale: z.looseObject({ reasons: z.array(z.string()), risks: z.array(z.string()).optional() }).nullable().optional(),
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
                z.looseObject({
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
          z.looseObject({
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
              z.looseObject({
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
      z.looseObject({
        id: z.string(),
        name: z.string(),
        bucket: z.enum(['liquid', 'investment']),
        subtype: z.enum(['bank', 'cash', 'gold', 'stocks', 'crypto', 'real_estate', 'other']),
        amount: z.number(),
        currency: fiatCurrencySchema,
        notes: z.string().optional(),
        asOfDate: dayString.optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
    )
    .optional(),
  savingsAccounts: z
    .array(
      z.looseObject({
        id: z.string(),
        heldInPaymentMethodId: z.string().optional(),
        name: z.string(),
        category: z.enum(['savings', 'investment']).optional(),
        type: savingsTypeSchema.optional(),
        icon: z.string().optional(),
        emoji: z.string().optional(),
        goalId: z.string().nullable().optional(),
        isMonthlySavings: z.boolean().optional(),
        currency: savingsCurrencySchema,
        currentBalance: z.number(),
        karat: z.union([z.literal(24), z.literal(22), z.literal(21), z.literal(18)]).optional(),
        createdAt: z.string(),
        notes: z.string().optional(),
        autoSave: z.unknown().optional(),
      })
    )
    .optional(),
  recurringSavingsDeposits: z
    .array(
      z.looseObject({
        id: z.string(),
        accountId: z.string(),
        amount: z.number(),
        currency: savingsCurrencySchema,
        frequency: z.literal('monthly'),
        dayOfMonth: z.number().int().min(1).max(28),
        nextDueDate: dayString,
        isActive: z.boolean(),
        notes: z.string().optional(),
        createdAt: z.string(),
      })
    )
    .optional(),
  savingsTransactions: z
    .array(
      z.looseObject({
        id: z.string(),
        occurredAt: stampString.optional(),
        paymentMethodId: z.string().optional(),
        accountId: z.string(),
        type: z.enum(['deposit', 'withdrawal']),
        amount: z.number(),
        currency: savingsCurrencySchema,
        date: dayString,
        source: z.string().optional(),
        notes: z.string().optional(),
        isAutoSave: z.boolean().optional(),
        isCashFlow: z.boolean().optional(),
        transferGroupId: z.string().optional(),
        idempotencyKey: z.string().optional(),
        pairId: z.string().optional(),
        accountAmount: z.number().optional(),
      })
    )
    .optional(),
  paymentMethods: z
    .array(
      z.looseObject({
        id: z.string(),
        parentId: z.string().optional(),
        paysFromPaymentMethodId: z.string().optional(),
        isSavings: z.boolean().optional(),
        openingBalance: z.number().optional(),
        openingAt: z.string().optional(),
        closedAt: z.string().optional(),
        trackSms: z.boolean().optional(),
        excluded: z.boolean().optional(),
        provisional: z.boolean().optional(),
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
      z.looseObject({
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
        installmentProviderName: z.string().optional(),
        installmentItemType: installmentItemTypeSchema.optional(),
        installmentItemIcon: z.string().optional(),
        linkedCreditCardDebtId: z.string().optional(),
        principalPaymentMethodId: z.string().optional(),
        defaultPaymentMethodId: z.string().optional(),
        principalAmount: z.number().positive().optional(),
        principalCurrency: currencySchema.optional(),
        principalAt: z.string().optional(),
        personName: z.string().optional(),
        relationship: z.string().optional(),
        direction: z.enum(['i_owe', 'they_owe']).optional(),
        installmentCount: z.number().optional(),
        installmentFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'annually']).optional(),
        installmentAmount: z.number().optional(),
        startDate: dayString.optional(),
        interestFree: z.boolean().optional(),
        creditor: z.string().optional(),
        receivedVia: z
          .enum(['cash', 'bank_transfer', 'card', 'crypto', 'gold', 'other'])
          .optional(),
        goal: z
          .object({
            targetDate: dayString,
            paymentFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'annually']),
            calculatedAmount: z.number(),
          })
          .optional(),
      })
    )
    .optional(),
  debtPayments: z
    .array(
      z.looseObject({
        id: z.string(),
        occurredAt: stampString.optional(),
        debtId: z.string(),
        date: dayString,
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
      z.looseObject({
        id: z.string(),
        debtId: z.string(),
        amount: z.number(),
        currency: currencySchema,
        paymentMethodId: z.string(),
        frequency: z.enum(['monthly', 'biweekly', 'weekly', 'quarterly', 'annually']),
        nextDueDate: dayString,
        isActive: z.boolean(),
        notes: z.string().optional(),
        createdAt: z.string(),
      })
    )
    .optional(),
  financialGoalsNotes: z.string().optional(),
  subscriptions: z
    .array(
      z.looseObject({
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
        startDate: dayString,
        nextBillingDate: dayString.nullable(),
        paymentMethodId: z.string().nullable(),
        expenseCategory: z.string(),
        linkedRecurringExpenseId: z.string().nullable(),
        status: z.enum(['active', 'cancelled', 'paused', 'trial']),
        notes: z.string().nullable(),
        createdAt: z.string(),
        cancelledAt: z.string().nullable(),
        updatedAt: z.string().optional(),
        tracking: z.enum(['sms', 'ask', 'log']).optional(),
        reminder: z.boolean().optional(),
        trialEnd: z.string().nullable().optional(),
        endsOn: z.string().nullable().optional(),
        pausedAt: z.string().nullable().optional(),
        priceHistory: z.array(z.looseObject({ amount: z.number(), from: z.string() })).optional(),
        pendingPlanFrom: z.string().nullable().optional(),
        sharedWith: z.array(z.string()).nullable().optional(),
        myShare: z.number().nullable().optional(),
      })
    )
    .optional(),
  goals: z
    .array(
      z.looseObject({
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
        targetDate: dayString.nullable(),
        linkedSavingsAccountIds: z.array(z.string()),
        linkedDebtIds: z.array(z.string()),
        monthlySpendingLimit: z.number().nullable(),
        spendingCategory: z.custom<ExpenseCategory>((v) => v == null || typeof v === 'string').nullable().optional(),
        priority: z.number(),
        status: z.enum(['active', 'achieved', 'paused', 'cancelled']),
        monthlyContribution: z.number().nullable(),
        fundingMode: z.enum(['share', 'fixed', 'manual']).optional(),
        sharePct: z.number().nullable().optional(),
        frequency: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
        planStart: z.string().nullable().optional(),
        notes: z.string().nullable(),
        createdAt: z.string(),
        achievedAt: z.string().nullable(),
      })
    )
    .optional(),
})
