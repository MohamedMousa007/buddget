'use client'

import { SlidersHorizontal } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'
import { BUDGET_PATHS } from '@/lib/navigation/bottomNavConfig'
import { navigate } from '@/lib/navigation/navigate'
import { useNavPath } from '@/lib/navigation/navStore'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/**
 * Budget's entry on the mobile header, beside the profile avatar. Soft teal while on a budget screen;
 * a dot means there is no live plan yet, so the button is also the invitation to make one.
 */
export function BudgetHeaderButton() {
  const t = useT()
  const pathname = useNavPath()
  const hasPlan = useFinanceStore((s) => selectActivePlan(s.budgetPlans, s.activeBudgetPlanId) != null)
  const on = [...BUDGET_PATHS].some((p) => pathname === p || pathname.startsWith(`${p}/`))
  return (
    <span className="relative inline-flex size-11 items-center justify-center">
      <IconButton
        variant={on ? 'brand' : 'tinted'}
        size="sm"
        shape="round"
        className="size-9"
        aria-label={t.nav.budgetSetup}
        aria-current={on ? 'page' : undefined}
        onClick={() => navigate('/budget-setup')}
      >
        <SlidersHorizontal className="size-[18px]" strokeWidth={1.75} />
      </IconButton>
      {hasPlan ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute end-1 top-1 size-2.5 rounded-full border-2 border-[var(--color-brand-bg)] bg-[var(--color-brand-primary)]"
        />
      )}
    </span>
  )
}
