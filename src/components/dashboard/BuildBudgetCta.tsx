'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { useActionToast } from '@/components/ui/ActionToast'
import { useAutoBudgetBuild } from '@/hooks/useAutoBudgetBuild'
import { useT } from '@/lib/i18n'

export interface BuildBudgetCtaProps {
  /** Called on successful build so the dashboard can reveal KPIs. */
  onBuilt?: (source: 'ai' | 'fallback') => void
}

/**
 * Primary call-to-action shown below the first-run checklist. Enabled once
 * all six cards are done; fires `useAutoBudgetBuild` which runs the AI
 * pipeline silently in the background (no interactive wizard) and
 * applies the resulting plan in a single transaction. Toasts success or
 * the local-fallback message depending on whether AI succeeded.
 */
export function BuildBudgetCta({ onBuilt }: BuildBudgetCtaProps) {
  const t = useT()
  const showToast = useActionToast()
  const { canBuild, building, build } = useAutoBudgetBuild()

  const handleClick = async () => {
    const res = await build()
    if (!res) {
      try {
        showToast(t.onboarding.buildBudgetErrorToast)
      } catch {
        /* toast provider not mounted in tests */
      }
      return
    }
    try {
      showToast(
        res.source === 'ai'
          ? t.onboarding.buildBudgetSuccessToast
          : t.onboarding.buildBudgetFallbackToast,
      )
    } catch {
      /* toast provider not mounted */
    }
    onBuilt?.(res.source)
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        type="button"
        data-tutorial-id="build-budget-cta"
        onClick={handleClick}
        disabled={!canBuild}
        className="h-12 rounded-2xl bg-[var(--color-brand-red)] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-brand-red-hover)] transition-colors"
      >
        {building ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            <span>{t.onboarding.buildBudgetPendingCta}</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" aria-hidden />
            <span>{t.onboarding.buildBudgetCta}</span>
          </>
        )}
      </button>
      {!canBuild && !building ? (
        <p className="text-center text-[11px] text-[var(--color-brand-text-muted)]">
          {t.onboarding.buildBudgetHint}
        </p>
      ) : null}
    </div>
  )
}
