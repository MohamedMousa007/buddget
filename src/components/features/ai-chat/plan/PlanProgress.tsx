'use client'

import { Button } from '@/components/ui/button'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { useBuddgyPlanCopy } from '@/lib/i18n/buddgyPlanCopy'

/** The strip under the chat header while a budget is being built: where the person is, and Pause. */
export function PlanProgress({ n, of, onPause }: { n: number; of: number; onPause: () => void }) {
  const copy = useBuddgyPlanCopy()
  const label = copy.progress(n, of)
  return (
    <div className="mx-3 mt-2 flex min-h-12 items-center gap-2.5 rounded-xl bg-[var(--color-brand-primary-soft)] py-1 pe-1 ps-3.5 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span dir="auto">{label}</span>
        <Progress value={Math.min(100, Math.round(((n - 1) / Math.max(1, of)) * 100))} aria-label={label}>
          <ProgressTrack className="bg-[var(--color-brand-card)]">
            <ProgressIndicator className="rounded-full bg-[var(--color-brand-primary)]" />
          </ProgressTrack>
        </Progress>
      </div>
      <Button variant="ghost" size="touch" onClick={onPause}>{copy.pause}</Button>
    </div>
  )
}
