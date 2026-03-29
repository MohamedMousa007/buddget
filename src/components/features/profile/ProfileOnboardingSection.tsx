'use client'

import type { User } from '@supabase/supabase-js'
import { ClipboardList, CheckCircle2, CircleDashed } from 'lucide-react'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
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
 * Onboarding progress checklist and CTA to re-run the survey.
 */
export function ProfileOnboardingSection({
  expertDone,
  pct,
  stages,
  supabaseConfigured,
  user,
  onRedoOnboarding,
}: ProfileOnboardingSectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4 border border-[var(--color-brand-border)]/80">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          Onboarding
        </h2>
      </div>
      {expertDone ? (
        <p className="text-sm text-[var(--color-brand-text-muted)]">
          You&apos;re all set! Run it again anytime to refresh your answers and get updated budget suggestions — your info will be prefilled.
        </p>
      ) : (
        <>
          <p className="text-sm text-[var(--color-brand-text-muted)]">
            Your progress is based on your survey answers and anything you&apos;ve already added — income, budgets, balances, and payment methods.
          </p>
          <Progress value={pct} className="gap-1">
            <ProgressTrack className="h-1.5 bg-[var(--color-brand-border)]">
              <ProgressIndicator className="bg-[var(--color-brand-red)]" />
            </ProgressTrack>
          </Progress>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">{pct}% complete</p>
          <ul className="space-y-2 pt-1">
            {stages.map((row) => (
              <li key={row.id} className="flex items-start gap-2">
                {row.status === 'complete' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                ) : (
                  <CircleDashed className="w-4 h-4 text-[var(--color-brand-text-muted)] shrink-0 mt-0.5" aria-hidden />
                )}
                <div>
                  <p className="text-xs font-medium text-white">{row.label}</p>
                  <p className="text-[10px] text-[var(--color-brand-text-muted)]">{row.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        type="button"
        onClick={onRedoOnboarding}
        className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
      >
        Continue onboarding
      </button>
      {supabaseConfigured && !user ? (
        <p className="text-[11px] text-[var(--color-brand-text-muted)]">
          Sign in first so your onboarding progress is saved and synced across devices.
        </p>
      ) : null}
    </section>
  )
}
