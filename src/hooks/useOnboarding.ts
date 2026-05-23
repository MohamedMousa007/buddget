'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
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

export interface OnboardingState {
  step: 1 | 2
  name: string
  country: string
  currency: Currency
  currencyOverrideOpen: boolean
  incomeAmount: string
  /** Display label key for income type selection — maps to IncomeSourceType */
  incomeTypeKey: 'salary' | 'freelance' | 'business' | 'other'
  incomeCurrency: Currency
  submitting: boolean
  error: string | null
}

export function useOnboarding() {
  const router = useRouter()
  const { updateSettings, updateProfile, addIncomeSource, addPaymentMethod } = useFinanceStore()

  const [state, setState] = useState<OnboardingState>({
    step: 1,
    name: '',
    country: '',
    currency: 'USD',
    currencyOverrideOpen: false,
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

  const nextStep = useCallback(() => {
    if (!state.name.trim()) return
    if (!state.country) return
    setState((prev) => ({ ...prev, step: 2, error: null }))
  }, [state.name, state.country])

  const prevStep = useCallback(() => {
    setState((prev) => ({ ...prev, step: 1, error: null }))
  }, [])

  const completeOnboarding = useCallback(async (liteMode: boolean, withIncome: boolean) => {
    setState((prev) => ({ ...prev, submitting: true, error: null }))
    try {
      const country = ONBOARDING_COUNTRIES.find((c) => c.code === state.country)
      updateSettings({ baseCurrency: state.currency })
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

      // Create default Cash payment method
      addPaymentMethod({
        name: 'Cash',
        type: 'cash',
        currency: state.currency,
        isDefault: true,
      })

      const res = await fetch('/api/auth/complete-journey', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to complete onboarding')

      router.push('/')
    } catch (e) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: e instanceof Error ? e.message : 'Something went wrong',
      }))
    }
  }, [state, updateSettings, updateProfile, addIncomeSource, addPaymentMethod, router])

  const handleSubmit = useCallback(() => {
    completeOnboarding(false, true)
  }, [completeOnboarding])

  const handleSkipIncome = useCallback((liteModeSelected: boolean) => {
    completeOnboarding(liteModeSelected, false)
  }, [completeOnboarding])

  return {
    state,
    setField,
    selectCountry,
    selectCurrency,
    nextStep,
    prevStep,
    handleSubmit,
    handleSkipIncome,
  }
}
