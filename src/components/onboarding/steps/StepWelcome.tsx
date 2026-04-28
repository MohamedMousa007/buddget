'use client'

import { useEffect, useRef } from 'react'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'

export function StepWelcome({ draft, updateDraft }: OnboardingStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center">
      <input
        ref={inputRef}
        id="onboarding-name"
        autoComplete="given-name"
        aria-label="Your first name"
        placeholder="Your first name"
        value={draft.name}
        onChange={(e) => updateDraft({ name: e.target.value })}
        className="w-full bg-transparent border-0 border-b-2 border-[#2A2A38] focus:border-[#E50914] text-white text-2xl text-center outline-none py-2"
      />
    </div>
  )
}
