'use client'

import { useOnboarding } from '@/hooks/useOnboarding'
import { OnboardingShell } from '@/components/features/onboarding/OnboardingShell'
import { StepIdentity } from '@/components/features/onboarding/StepIdentity'
import { StepIncome } from '@/components/features/onboarding/StepIncome'

type IncomeTypeKey = 'salary' | 'freelance' | 'business' | 'other'

/**
 * Single-page 2-step onboarding flow.
 * Step 1: Identity (name + country + currency)
 * Step 2: Income (optional, with lite-mode skip)
 */
export default function OnboardingPage() {
  const { state, setField, selectCountry, selectCurrency, nextStep, prevStep, handleSubmit, handleSkipIncome } =
    useOnboarding()

  return (
    <OnboardingShell step={state.step} onBack={state.step === 2 ? prevStep : undefined}>
      {state.step === 1 ? (
        <StepIdentity
          state={state}
          onNameChange={(name) => setField('name', name)}
          onCountrySelect={selectCountry}
          onCurrencySelect={selectCurrency}
          onToggleCurrencyOverride={() => setField('currencyOverrideOpen', !state.currencyOverrideOpen)}
          onNext={nextStep}
        />
      ) : (
        <StepIncome
          state={state}
          onAmountChange={(v) => setField('incomeAmount', v)}
          onTypeChange={(v: IncomeTypeKey) => setField('incomeTypeKey', v)}
          onSubmit={handleSubmit}
          onSkip={handleSkipIncome}
        />
      )}
    </OnboardingShell>
  )
}
