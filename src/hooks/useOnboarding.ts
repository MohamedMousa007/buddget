'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { createClient } from '@/lib/supabase/client'
import type { Currency, IncomeSourceType } from '@/lib/store/types'

export const ONBOARDING_COUNTRIES: {
  code: string
  name: string
  flag: string
  currency: Currency
}[] = [
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', currency: 'EGP' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴', currency: 'JOD' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼', currency: 'KWD' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦', currency: 'QAR' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭', currency: 'BHD' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲', currency: 'OMR' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', currency: 'MAD' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳', currency: 'TND' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧', currency: 'USD' },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', currency: 'EUR' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', currency: 'EUR' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', currency: 'EUR' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'USD' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'USD' },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'USD' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', currency: 'USD' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'USD' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'USD' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'USD' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', currency: 'EUR' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', currency: 'USD' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'USD' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', currency: 'USD' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', currency: 'USD' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', currency: 'USD' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', currency: 'USD' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', currency: 'USD' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'USD' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾', currency: 'USD' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾', currency: 'USD' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶', currency: 'USD' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪', currency: 'USD' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩', currency: 'USD' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'USD' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: 'USD' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'USD' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', currency: 'USD' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', currency: 'EUR' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', currency: 'EUR' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', currency: 'EUR' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', currency: 'EUR' },
]

export type FinancialGoal =
  | 'emergency_fund'
  | 'pay_debt'
  | 'big_purchase'
  | 'investments'
  | 'daily_tracking'
  | 'reduce_expenses'

export type IncomeRangeKey = 'under_1k' | '1k_3k' | '3k_7k' | '7k_15k' | '15k_plus'
export type MoneyManagementMethod = 'spreadsheet' | 'another_app' | 'in_my_head' | 'dont_track'
export type SpendingCategory =
  | 'food'
  | 'transport'
  | 'housing'
  | 'health'
  | 'entertainment'
  | 'shopping'
  | 'travel'
  | 'education'

export const TOTAL_ONBOARDING_STEPS = 5

export interface OnboardingState {
  step: 1 | 2 | 3 | 4 | 5
  // Step 1 — identity
  name: string
  country: string
  currency: Currency
  secondaryCurrency: Currency | ''
  currencyOverrideOpen: boolean
  // Step 2 — financial goals
  financialGoals: FinancialGoal[]
  // Step 3 — spending profile
  incomeRange: IncomeRangeKey | ''
  moneyManagementMethod: MoneyManagementMethod | ''
  spendingCategories: SpendingCategory[]
  smsTrackingEnabled: boolean
  // Step 4 — income (optional)
  incomeAmount: string
  incomeTypeKey: 'salary' | 'freelance' | 'business' | 'other'
  incomeCurrency: Currency
  // submission
  submitting: boolean
  error: string | null
}

/**
 * Drives the 5-step onboarding flow: identity → goals → spending profile →
 * income → review. Handles completion with session refresh so the middleware
 * and AuthProvider see the new `onboarding_completed` flag immediately.
 */
export function useOnboarding() {
  const router = useRouter()
  const { updateSettings, updateProfile, addIncomeSource, addPaymentMethod } = useFinanceStore()

  const [state, setState] = useState<OnboardingState>({
    step: 1,
    name: '',
    country: '',
    currency: 'USD',
    secondaryCurrency: '',
    currencyOverrideOpen: false,
    financialGoals: [],
    incomeRange: '',
    moneyManagementMethod: '',
    spendingCategories: [],
    smsTrackingEnabled: false,
    incomeAmount: '',
    incomeTypeKey: 'salary',
    incomeCurrency: 'USD',
    submitting: false,
    error: null,
  })

  const setField = useCallback(<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const selectCountry = useCallback((code: string) => {
    const entry = ONBOARDING_COUNTRIES.find((c) => c.code === code)
    if (!entry) return
    setState((prev) => ({
      ...prev,
      country: code,
      currency: prev.currencyOverrideOpen ? prev.currency : entry.currency,
      incomeCurrency: prev.currencyOverrideOpen ? prev.incomeCurrency : entry.currency,
    }))
  }, [])

  const selectCurrency = useCallback((currency: Currency) => {
    setState((prev) => ({
      ...prev,
      currency,
      incomeCurrency: currency,
      currencyOverrideOpen: false,
    }))
  }, [])

  const toggleGoal = useCallback((goal: FinancialGoal) => {
    setState((prev) => ({
      ...prev,
      financialGoals: prev.financialGoals.includes(goal)
        ? prev.financialGoals.filter((g) => g !== goal)
        : [...prev.financialGoals, goal],
    }))
  }, [])

  const toggleCategory = useCallback((category: SpendingCategory) => {
    setState((prev) => ({
      ...prev,
      spendingCategories: prev.spendingCategories.includes(category)
        ? prev.spendingCategories.filter((c) => c !== category)
        : [...prev.spendingCategories, category],
    }))
  }, [])

  const nextStep = useCallback(() => {
    setState((prev) => {
      if (prev.step === 1 && (!prev.name.trim() || !prev.country)) return prev
      const next = Math.min(prev.step + 1, TOTAL_ONBOARDING_STEPS) as OnboardingState['step']
      return { ...prev, step: next, error: null }
    })
  }, [])

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1) as OnboardingState['step'],
      error: null,
    }))
  }, [])

  const goToStep = useCallback((step: OnboardingState['step']) => {
    setState((prev) => ({ ...prev, step, error: null }))
  }, [])

  const completeOnboarding = useCallback(
    async (liteMode: boolean, withIncome: boolean) => {
      setState((prev) => ({ ...prev, submitting: true, error: null }))
      try {
        const country = ONBOARDING_COUNTRIES.find((c) => c.code === state.country)
        // smsTrackingEnabled is owned by useSmsTracking (it arms the native
        // bridge on toggle); don't write it here or we'd clobber the
        // native-authoritative value with the stale onboarding-local one.
        updateSettings({
          baseCurrency: state.currency,
          secondaryCurrency: state.secondaryCurrency || null,
          showSecondaryCurrency: !!state.secondaryCurrency,
        })
        updateProfile({
          name: state.name.trim(),
          country: country?.code ?? state.country,
          liteMode,
          onboardingVersion: 2,
        })

        if (withIncome && state.incomeAmount) {
          const amount = parseFloat(state.incomeAmount)
          const typeMap: Record<string, IncomeSourceType> = {
            salary: 'salary',
            freelance: 'side_hustle',
            business: 'other',
            other: 'other',
          }
          if (amount > 0) {
            addIncomeSource({
              name: 'Primary income',
              amount,
              currency: state.incomeCurrency,
              isRecurring: true,
              recurringFrequency: 'monthly',
              sourceType: typeMap[state.incomeTypeKey] ?? 'salary',
            })
          }
        }

        addPaymentMethod({
          name: 'Cash',
          type: 'cash',
          currency: state.currency,
          isDefault: true,
        })

        const { apiFetchAuth } = await import('@/lib/apiBase')
        const res = await apiFetchAuth('/api/auth/complete-journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            financialGoals: state.financialGoals,
            incomeRange: state.incomeRange,
            moneyManagementMethod: state.moneyManagementMethod,
            spendingCategories: state.spendingCategories,
          }),
        })
        if (!res.ok) throw new Error('Failed to complete onboarding')

        // Refresh client session so user_metadata.onboarding_completed=true is
        // visible to AuthProvider before router.push — without this the
        // post-completion navigation lands on an indefinite loading splash.
        const supabase = createClient()
        await supabase.auth.refreshSession()

        router.push('/')
      } catch (e) {
        setState((prev) => ({
          ...prev,
          submitting: false,
          error: e instanceof Error ? e.message : 'Something went wrong',
        }))
      }
    },
    [state, updateSettings, updateProfile, addIncomeSource, addPaymentMethod, router],
  )

  const handleSubmit = useCallback(() => completeOnboarding(false, true), [completeOnboarding])
  const handleSkipIncome = useCallback(
    (liteModeSelected: boolean) => completeOnboarding(liteModeSelected, false),
    [completeOnboarding],
  )

  return {
    state,
    setField,
    selectCountry,
    selectCurrency,
    toggleGoal,
    toggleCategory,
    nextStep,
    prevStep,
    goToStep,
    handleSubmit,
    handleSkipIncome,
  }
}
