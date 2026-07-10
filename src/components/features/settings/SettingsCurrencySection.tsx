'use client'

import { Globe } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { useT } from '@/lib/i18n'
import type { Currency, FinanceStore } from '@/lib/store/types'
import { CurrencyConverter } from '@/components/features/settings/CurrencyConverter'

export interface SettingsCurrencySectionProps {
  store: FinanceStore
}

const CURRENCY_FIELD_CLASS =
  'mt-1 w-full h-11 px-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]'

/**
 * Primary/secondary currency, form picker restriction, and interactive rate converter.
 */
export function SettingsCurrencySection({ store }: SettingsCurrencySectionProps) {
  const t = useT()

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
        <FiatCurrencyField
          value={store.settings.baseCurrency}
          onChange={(next) => store.updateSettings({ baseCurrency: next })}
          className={CURRENCY_FIELD_CLASS}
        />
        <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">
          {t.settings.mainCurrencyHint}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm text-[var(--color-brand-text-primary)]">{t.settings.secondaryToggle}</Label>
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
          <FiatCurrencyField
            value={store.settings.secondaryCurrency ?? store.settings.baseCurrency}
            onChange={(next) => store.updateSettings({ secondaryCurrency: next as Currency })}
            className={CURRENCY_FIELD_CLASS}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="min-w-0">
          <Label className="text-sm text-[var(--color-brand-text-primary)]">{t.settings.onlyMyCurrencies}</Label>
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

      <CurrencyConverter store={store} />
    </section>
  )
}
