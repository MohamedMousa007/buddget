'use client'

import { Globe, RefreshCw } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils/formatters'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { useT } from '@/lib/i18n'
import type { Currency, FinanceStore } from '@/lib/store/types'

export interface SettingsCurrencySectionProps {
  store: FinanceStore
}

/**
 * Primary/secondary currency, form picker restriction, rates display.
 */
export function SettingsCurrencySection({ store }: SettingsCurrencySectionProps) {
  const t = useT()
  const { formatRelativeTime } = useLocalizedFormatters()

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.settings.currencyTitle}
        </h2>
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.settings.mainCurrencyLabel}</Label>
        <select
          value={store.settings.baseCurrency}
          onChange={(e) => store.updateSettings({ baseCurrency: e.target.value as Currency })}
          className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
        >
          {FIAT_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">
          {t.settings.mainCurrencyHint}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm text-white">{t.settings.secondaryToggle}</Label>
          <p className="text-[10px] text-[var(--color-brand-text-muted)]">
            {t.settings.secondaryHint}
          </p>
        </div>
        <Switch
          checked={store.settings.showSecondaryCurrency}
          onCheckedChange={(val) => store.updateSettings({ showSecondaryCurrency: val })}
        />
      </div>

      {store.settings.showSecondaryCurrency ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.settings.secondaryCurrencyLabel}</Label>
          <select
            value={store.settings.secondaryCurrency || ''}
            onChange={(e) => store.updateSettings({ secondaryCurrency: (e.target.value || null) as Currency | null })}
            className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
          >
            <option value="">{t.settings.secondaryNone}</option>
            {FIAT_CURRENCIES.filter((c) => c !== store.settings.baseCurrency).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="min-w-0">
          <Label className="text-sm text-white">{t.settings.onlyMyCurrencies}</Label>
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1 leading-relaxed">
            {t.settings.onlyMyCurrenciesDesc}
          </p>
        </div>
        <Switch
          checked={!store.settings.showAllCurrenciesInForms}
          onCheckedChange={(val) => store.updateSettings({ showAllCurrenciesInForms: !val })}
          className="shrink-0"
        />
      </div>

      <Separator className="bg-[var(--color-brand-border)]" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.settings.liveRates}</p>
          <p className="text-xs text-[var(--color-brand-text-muted)] flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {store.lastRatesFetch ? `${t.settings.ratesRefreshed}${formatRelativeTime(store.lastRatesFetch)}` : t.settings.ratesNotRefreshed}
          </p>
        </div>
        <div className="space-y-1.5">
          {Object.entries(store.exchangeRates).map(([key, rate]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-[var(--color-brand-text-secondary)]">{key.replace('_', ' → ')}</span>
              <span className="font-mono-numbers text-white">{(rate as number).toFixed(4)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-brand-gold)]">{t.settings.goldLabel}</span>
            <span className="font-mono-numbers text-[var(--color-brand-gold)]">
              {formatCurrency(store.goldPricePerGram, store.settings.baseCurrency)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
