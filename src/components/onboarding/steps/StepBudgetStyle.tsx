'use client'

import { Check } from 'lucide-react'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import { ONBOARDING_BUDGET_STYLE_CARDS } from '@/lib/onboarding/personas'
import { cn } from '@/lib/utils'

export function StepBudgetStyle({ draft, updateDraft }: OnboardingStepProps) {
  return (
    <div className="w-full max-w-lg mx-auto space-y-3 flex-1 flex flex-col">
      {ONBOARDING_BUDGET_STYLE_CARDS.map((card) => {
        const on = draft.budgetStyle === card.budgetStyle
        return (
          <button
            key={card.budgetStyle}
            type="button"
            onClick={() => updateDraft({ budgetStyle: card.budgetStyle })}
            className={cn(
              'relative w-full text-left p-5 rounded-2xl border transition-colors',
              on ? 'border-[#E50914] bg-[#E50914]/10' : 'border-[#2A2A38] bg-[#111118] hover:border-[#5A5A72]',
            )}
            aria-pressed={on}
          >
            {on ? (
              <Check
                className="absolute top-4 end-4 h-5 w-5 text-[#E50914]"
                aria-hidden
                strokeWidth={2.5}
              />
            ) : null}
            <span className="text-2xl block mb-2" aria-hidden>
              {card.emoji}
            </span>
            <p className="font-semibold text-white text-lg">{card.title}</p>
            <p className="text-sm text-[#A0A0B8] mt-2 leading-snug">{card.description}</p>
          </button>
        )
      })}
    </div>
  )
}
