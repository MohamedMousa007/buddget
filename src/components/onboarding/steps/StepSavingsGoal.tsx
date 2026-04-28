'use client'

import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'

const QUICK = [500, 1000, 2000] as const

export function StepSavingsGoal({ draft, updateDraft }: OnboardingStepProps) {
  const cur = draft.baseCurrency

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6 flex-1">
      <p className="text-center text-[#A0A0B8] text-sm">
        How much do you want to set aside each month?
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-2xl text-white">
        <span className="text-[#5A5A72]">{cur}</span>
        <input
          type="number"
          min={0}
          step={1}
          value={draft.savingsGoal ?? ''}
          onChange={(e) => {
            const v = e.target.value
            updateDraft({ savingsGoal: v === '' ? null : parseFloat(v) || 0 })
          }}
          placeholder="____"
          className="w-36 bg-transparent border-0 border-b-2 border-[#2A2A38] focus:border-[#E50914] text-center text-2xl text-white outline-none py-2"
          aria-label="Monthly savings amount"
        />
        <span className="text-lg text-[#A0A0B8]">per month</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {QUICK.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => updateDraft({ savingsGoal: n })}
            className="px-4 py-2 rounded-xl border border-[#2A2A38] text-sm text-white hover:border-[#E50914] bg-[#111118]"
          >
            {cur} {n.toLocaleString('en-US')}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => updateDraft({ savingsGoal: null })}
        className="text-sm text-[#E50914] hover:underline self-center"
      >
        Skip for now
      </button>
    </div>
  )
}
