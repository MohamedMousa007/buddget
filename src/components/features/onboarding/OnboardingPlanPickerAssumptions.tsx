'use client'

import { shortPlanLine } from '@/lib/onboarding/planPickerCopy'

export function OnboardingPlanPickerAssumptions({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 2).map((a) => (
        <span
          key={a}
          className="inline-flex items-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 px-3 py-1 text-[11px] text-[var(--color-brand-text-secondary)]"
        >
          {shortPlanLine(a, 90)}
        </span>
      ))}
    </div>
  )
}
