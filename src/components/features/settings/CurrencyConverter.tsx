'use client'

import { RefreshCw } from 'lucide-react'
import type { FinanceStore } from '@/lib/store/types'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useT } from '@/lib/i18n'
import { CurrencyConverterCore } from '@/components/features/settings/CurrencyConverterCore'
import { CurrencyConverterGoldRow } from '@/components/features/settings/CurrencyConverterGoldRow'

export interface CurrencyConverterProps {
  store: FinanceStore
}

/**
 * Google-style fiat converter using live rates from the finance store (fed by `/api/rates`).
 */
export function CurrencyConverter({ store }: CurrencyConverterProps) {
  const t = useT()
  const { formatRelativeTime } = useLocalizedFormatters()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-[var(--color-brand-text-secondary)] font-medium uppercase tracking-wider">
          {t.settings.currencyConverterTitle}
        </p>
        <p className="text-xs text-[var(--color-brand-text-muted)] flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          {store.lastRatesFetch
            ? `${t.settings.ratesRefreshed}${formatRelativeTime(store.lastRatesFetch)}`
            : t.settings.ratesNotRefreshed}
        </p>
      </div>

      <CurrencyConverterCore store={store} t={t.settings} />
      <CurrencyConverterGoldRow store={store} t={t.settings} />
    </div>
  )
}
