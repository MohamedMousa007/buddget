'use client'

import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { normalizeCategoryPercents } from '@/lib/onboarding/planNormalization'
import type { OnboardingAiPlan } from '@/lib/store/types'

export function OnboardingPlanPickerNav({
  idx,
  plansLength,
  busy,
  onPrev,
  onNext,
  acceptPayload,
  onAccept,
}: {
  idx: number
  plansLength: number
  busy: boolean
  onPrev: () => void
  onNext: () => void
  acceptPayload: OnboardingAiPlan
  onAccept: (plan: OnboardingAiPlan) => void
}) {
  const t = useT()
  const o = t.onboarding

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={idx <= 0 || busy}
          onClick={onPrev}
          className="flex-1 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-primary)] disabled:opacity-40 flex items-center justify-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          {o.planPickerPrevious}
        </button>
        <button
          type="button"
          disabled={idx >= plansLength - 1 || busy}
          onClick={onNext}
          className="flex-1 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-primary)] disabled:opacity-40 flex items-center justify-center gap-1"
        >
          {o.planPickerNext}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => onAccept({ ...acceptPayload, percents: normalizeCategoryPercents(acceptPayload.percents) })}
        className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? o.planPickerAcceptBusy : o.planPickerAccept}
        <Check className="w-4 h-4" />
      </button>
    </>
  )
}
