'use client'

import { ChevronLeft } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface OnboardingShellProps {
  step: 1 | 2
  onBack?: () => void
  children: React.ReactNode
}

/**
 * Full-screen mobile-first wrapper for the 2-step onboarding flow.
 * Renders brand wordmark, step progress dots, and optional back nav.
 */
export function OnboardingShell({ step, onBack, children }: OnboardingShellProps) {
  const t = useT()

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] flex flex-col items-center px-4 py-6">
      {/* Top bar */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        {step === 2 && onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden />
            {t.onboarding.backButton}
          </button>
        ) : (
          <div className="w-16" />
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full transition-colors ${step >= 1 ? 'bg-[var(--color-brand-red)]' : 'bg-[var(--color-brand-border)]'}`}
          />
          <span
            className={`w-2.5 h-2.5 rounded-full transition-colors ${step >= 2 ? 'bg-[var(--color-brand-red)]' : 'bg-[var(--color-brand-border)]'}`}
          />
        </div>

        <div className="w-16" />
      </div>

      {/* Wordmark */}
      <div className="mb-8 text-center">
        <p className="text-2xl font-bold tracking-tight text-[var(--color-brand-text-primary)]">
          budget<span className="text-[var(--color-brand-red)]">.ai</span>
        </p>
        <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">Buddget</p>
      </div>

      {/* Step content */}
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
