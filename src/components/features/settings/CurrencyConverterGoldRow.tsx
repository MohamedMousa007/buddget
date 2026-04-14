'use client'

import type { FinanceStore } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'

type SettingsCopy = Dictionary['settings']

/** 24K gold spot per gram (same block as the old settings rates section). */
export function CurrencyConverterGoldRow({
  store,
  t,
}: {
  store: FinanceStore
  t: SettingsCopy
}) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-brand-border)]">
      <div className="flex justify-between items-center gap-2">
        <span className="text-sm text-[var(--color-brand-gold)] flex items-center gap-1.5">
          <span>✦</span> {t.goldLabel}
        </span>
        {store.goldPriceAvailable !== false ? (
          <span className="font-mono-numbers text-sm text-[var(--color-brand-gold)]">
            {store.goldPricePerGram.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            {store.settings.baseCurrency}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-brand-text-muted)] italic">{t.goldPriceUnavailable}</span>
        )}
      </div>
    </div>
  )
}
