'use client'

import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import Link from 'next/link'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'

/**
 * Compact dashboard banner shown after completing new onboarding (v2).
 * Prompts the user to complete remaining setup items (income / budget).
 * Dismissable permanently via onboardingChecklistHidden setting.
 */
export function SetupChecklist() {
  const t = useT()
  const snap = useFinanceStore(
    useShallow((s) => ({
      version: s.profile.onboardingVersion ?? 0,
      liteMode: s.profile.liteMode ?? false,
      incomeCount: s.incomeSources.length,
      budgetTotal: s.budgetCategories.reduce((sum, c) => sum + c.budgetedAmount, 0),
      hidden: s.settings.onboardingChecklistHidden,
    })),
  )
  const updateSettings = useFinanceStore((s) => s.updateSettings)

  // Only show for new-flow completions
  if (snap.version < 2) return null
  if (snap.hidden) return null

  const items: { key: string; label: string; href: string; done: boolean }[] = [
    {
      key: 'income',
      label: snap.liteMode ? t.onboarding.checklistLiteModeNote : t.onboarding.checklistIncomePrompt,
      href: '/income',
      done: snap.incomeCount > 0 || snap.liteMode,
    },
    {
      key: 'budget',
      label: t.onboarding.checklistBudgetPrompt,
      href: '/budget-setup',
      done: snap.budgetTotal > 0,
    },
  ]

  const pendingItems = items.filter((i) => !i.done)
  if (pendingItems.length === 0) return null

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {pendingItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-2 text-sm text-[var(--color-brand-text-primary)] hover:text-[var(--color-brand-red)] transition-colors group"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-red)] shrink-0" aria-hidden />
              {item.label}
            </Link>
          ))}
        </div>
        <button
          onClick={() => updateSettings({ onboardingChecklistHidden: true })}
          aria-label={t.onboarding.checklistDismiss}
          className="text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors shrink-0"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
