'use client'

import { AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { HeroBand } from '@/components/features/hero/HeroBand'
import { formatCurrency } from '@/lib/utils/formatters'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { useT } from '@/lib/i18n'

/**
 * Reports' hero: same net-worth formula as the dashboard, on the shared HeroBand.
 */
export function ReportsNetWorthPanel() {
  const t = useT()
  const nw = useNetWorth()
  const hidden = useMask('hero')
  const secondary = useFinanceStore(useShallow((s) => s.settings.secondaryCurrency))

  return (
    <HeroBand
      label={t.reports.netWorthTitle}
      numbers={
        <>
          <span className="min-w-0 truncate whitespace-nowrap font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">
            {hidden ? MASK : formatCurrency(nw.netWorth, nw.baseCurrency, true)}
          </span>
          {nw.netWorthSecondary != null && secondary ? (
            <span className="shrink-0 font-mono-numbers text-[13px] text-[var(--flow-band-fg-2)]">
              {hidden ? MASK : `(${formatCurrency(nw.netWorthSecondary, secondary, true)})`}
            </span>
          ) : null}
        </>
      }
      note={
        <>
          {nw.netWorthGoldIncomplete ? (
            <span className="mb-1 flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-brand-gold)]" aria-hidden />
              <span>{t.reports.netWorthGoldIncomplete}</span>
            </span>
          ) : null}
          {t.reports.netWorthHint}
        </>
      }
    />
  )
}
