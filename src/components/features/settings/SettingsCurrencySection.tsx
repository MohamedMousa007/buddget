'use client'

import { useMemo } from 'react'
import { Globe } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { useT } from '@/lib/i18n'
import type { Currency, FinanceStore } from '@/lib/store/types'
import { CurrencyConverter } from '@/components/features/settings/CurrencyConverter'

export interface SettingsCurrencySectionProps {
  store: FinanceStore
}

/**
 * Primary/secondary currency, form picker restriction, and interactive rate converter.
 */
export function SettingsCurrencySection({ store }: SettingsCurrencySectionProps) {
  const t = useT()

  const baseItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => FIAT_CURRENCIES.map((c) => ({ value: c, label: c })),
    [],
  )
  const secondaryItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: '', label: t.settings.secondaryNone },
      ...FIAT_CURRENCIES.filter((c) => c !== store.settings.baseCurrency).map((c) => ({
        value: c,
        label: c,
      })),
    ],
    [store.settings.baseCurrency, t.settings.secondaryNone],
  )

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
        <SelectField
          value={store.settings.baseCurrency}
          onChange={(next) => store.updateSettings({ baseCurrency: next as Currency })}
          items={baseItems}
          aria-label={t.settings.mainCurrencyLabel}
          className="mt-1"
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
          <SelectField
            value={store.settings.secondaryCurrency ?? ''}
            onChange={(next) =>
              store.updateSettings({
                secondaryCurrency: (next || null) as Currency | null,
              })
            }
            items={secondaryItems}
            aria-label={t.settings.secondaryCurrencyLabel}
            className="mt-1"
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
