'use client'

import { useOnboarding, TOTAL_ONBOARDING_STEPS } from '@/hooks/useOnboarding'
import { OnboardingShell } from '@/components/features/onboarding/OnboardingShell'
import { StepIdentity } from '@/components/features/onboarding/StepIdentity'
import { StepGoals } from '@/components/features/onboarding/StepGoals'
import { StepSpending } from '@/components/features/onboarding/StepSpending'
import { StepIncome } from '@/components/features/onboarding/StepIncome'
import { StepReview } from '@/components/features/onboarding/StepReview'
import type { Currency } from '@/lib/store/types'
import type { IncomeRangeKey, MoneyManagementMethod } from '@/hooks/useOnboarding'

type IncomeTypeKey = 'salary' | 'freelance' | 'business' | 'other'

/**
 * Multi-step onboarding flow: identity → goals → spending profile → income → review.
 */
export default function OnboardingPage() {
  const {
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
  } = useOnboarding()

  return (
    <OnboardingShell step={state.step} totalSteps={TOTAL_ONBOARDING_STEPS} onBack={state.step > 1 ? prevStep : undefined}>
      {state.step === 1 && (
        <StepIdentity
          state={state}
          onNameChange={(name) => setField('name', name)}
          onCountrySelect={selectCountry}
          onCurrencySelect={selectCurrency}
          onToggleCurrencyOverride={() => setField('currencyOverrideOpen', !state.currencyOverrideOpen)}
          onSecondaryCurrencySelect={(c) => setField('secondaryCurrency', c as Currency | '')}
          onNext={nextStep}
        />
      )}
      {state.step === 2 && (
        <StepGoals
          state={state}
          onToggleGoal={toggleGoal}
          onNext={nextStep}
          onSkip={nextStep}
        />
      )}
      {state.step === 3 && (
        <StepSpending
          state={state}
          onIncomeRangeSelect={(r) => setField('incomeRange', r as IncomeRangeKey)}
          onManagementSelect={(m) => setField('moneyManagementMethod', m as MoneyManagementMethod)}
          onToggleCategory={toggleCategory}
          onToggleSms={(v) => setField('smsTrackingEnabled', v)}
          onNext={nextStep}
        />
      )}
      {state.step === 4 && (
        <StepIncome
          state={state}
          onAmountChange={(v) => setField('incomeAmount', v)}
          onTypeChange={(v: IncomeTypeKey) => setField('incomeTypeKey', v)}
          onSubmit={nextStep}
          onSkip={nextStep}
        />
      )}
      {state.step === 5 && (
        <StepReview
          state={state}
          onEdit={goToStep}
          onSubmit={handleSubmit}
          onSkipIncome={handleSkipIncome}
        />
      )}
    </OnboardingShell>
  )
}
