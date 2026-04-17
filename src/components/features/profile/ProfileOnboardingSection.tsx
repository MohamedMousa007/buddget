'use client'

import type { User } from '@supabase/supabase-js'
import { ClipboardList, CheckCircle2, CircleDashed, Sparkles } from 'lucide-react'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { useT } from '@/lib/i18n'
import type { OnboardingStageRow } from '@/lib/onboarding/onboardingStages'

export interface ProfileOnboardingSectionProps {
  expertDone: boolean
  pct: number
  stages: OnboardingStageRow[]
  supabaseConfigured: boolean
  user: User | null
  onRedoOnboarding: () => void
}

/**
 * "Complete account setup" card. Always lists every onboarding stage with per-row
 * status; shows a progress bar + "Continue setup" CTA while incomplete, or a
 * success header when 100%.
 */
export function ProfileOnboardingSection({
  expertDone,
  pct,
  stages,
  supabaseConfigured,
  user,
  onRedoOnboarding,
}: ProfileOnboardingSectionProps) {
  const t = useT()

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4 border border-[var(--color-brand-border)]/80">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.profile.setupTitle}
        </h2>
      </div>

      {expertDone ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-brand-green)]/35 bg-[var(--color-brand-green)]/10 px-3 py-2">
          <Sparkles className="w-4 h-4 text-[var(--color-brand-green)] shrink-0" aria-hidden />
          <p className="text-sm text-[var(--color-brand-green)]">{t.profile.setupComplete}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--color-brand-text-muted)]">{t.profile.onboardingProgressBody}</p>
          <Progress value={pct} className="gap-1">
            <ProgressTrack className="h-1.5 bg-[var(--color-brand-border)]">
              <ProgressIndicator className="bg-[var(--color-brand-red)]" />
            </ProgressTrack>
          </Progress>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">{t.profile.onboardingPctComplete(pct)}</p>
        </>
      )}

      <ul className="space-y-2 pt-1">
        {stages.map((row) => {
          const done = row.status === 'complete'
          return (
            <li key={row.id} className="flex items-start gap-2">
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-green)] shrink-0 mt-0.5" aria-hidden />
              ) : (
                <CircleDashed className="w-4 h-4 text-[var(--color-brand-text-muted)] shrink-0 mt-0.5" aria-hidden />
              )}
              <div>
                <p
                  className={
                    'text-xs font-medium ' +
                    (done ? 'text-[var(--color-brand-text-primary)]' : 'text-[var(--color-brand-text-primary)]')
                  }
                >
                  {row.label}
                </p>
                <p className="text-[10px] text-[var(--color-brand-text-muted)]">{row.description}</p>
              </div>
            </li>
          )
        })}
      </ul>

      {!expertDone ? (
        <button
          type="button"
          onClick={onRedoOnboarding}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
        >
          {t.profile.onboardingContinue}
        </button>
      ) : null}

      {supabaseConfigured && !user ? (
        <p className="text-[11px] text-[var(--color-brand-text-muted)]">{t.profile.onboardingSignInHint}</p>
      ) : null}
    </section>
  )
}
