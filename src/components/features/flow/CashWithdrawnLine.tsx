'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { useOpenSetting } from '@/hooks/useOpenSetting'
import { formatFlex } from '@/lib/utils/formatters'
import { cashWithdrawnThisCycle } from '@/lib/spending/cashLog'
import { Button } from '@/components/ui/button'

/** Cash taken out of the bank is not spending; this says so, quietly, and leads to the switch that changes it. */
export function CashWithdrawnLine() {
  const t = useT()
  const openSetting = useOpenSetting()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const { expenses, monthStartDay, base, rates } = useFinanceStore(
    useShallow((s) => ({ expenses: s.expenses, monthStartDay: s.settings.monthStartDay, base: s.settings.baseCurrency, rates: s.exchangeRates })),
  )
  const total = cashWithdrawnThisCycle(expenses, monthFilter, monthStartDay, base, rates)
  if (total <= 0) return null
  return (
    <div className="mx-4 mt-3 flex min-h-11 items-center justify-between gap-2">
      <p className="min-w-0 text-xs text-[var(--color-brand-text-secondary)]">{t.flow.cashWithdrawn(`${formatFlex(total)} ${base}`)}</p>
      <Button variant="link" size="touch" onClick={() => openSetting('cashWithdrawals')}>
        {t.flow.cashWithdrawnChange}
      </Button>
    </div>
  )
}
