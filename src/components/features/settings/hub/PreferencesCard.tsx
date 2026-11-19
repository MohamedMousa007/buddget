'use client'

import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { BaseCurrencyChangeSheet } from '@/components/features/settings/BaseCurrencyChangeSheet'
import { CurrencyConverter } from '@/components/features/settings/CurrencyConverter'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { Switch } from '@/components/ui/switch'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { defaultSecondCurrency, useSettingToggle } from '@/hooks/useSettingToggle'
import { useBaseCurrencySwitch } from '@/hooks/useBaseCurrencySwitch'
import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { applyTheme } from '@/lib/theme/applyTheme'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Currency } from '@/lib/store/types'

const NEXT_THEME = { light: 'dark', dark: 'system', system: 'light' } as const

function CentsRow() {
  const copy = useSettingsHubCopy()
  const cents = useSettingToggle('showCents')
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-[var(--color-brand-elevated)] px-4" data-setting-id="showCents">
      <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{copy.showCents}</span>
      <Switch size="touch" aria-label={copy.showCents} checked={cents.on} onCheckedChange={cents.set} />
    </label>
  )
}

function ConverterBody() {
  const { exchangeRates, lastRatesFetch, goldPriceAvailable, goldPricePerGram, goldPriceStale, baseCurrency, secondaryCurrency } = useFinanceStore(
    useShallow((s) => ({
      exchangeRates: s.exchangeRates,
      lastRatesFetch: s.lastRatesFetch,
      goldPriceAvailable: s.goldPriceAvailable,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceStale: s.goldPriceStale,
      baseCurrency: s.settings.baseCurrency,
      secondaryCurrency: s.settings.secondaryCurrency,
    })),
  )
  const store = { exchangeRates, lastRatesFetch, goldPriceAvailable, goldPricePerGram, goldPriceStale, settings: { baseCurrency, secondaryCurrency } }
  return <CurrencyConverter store={store} />
}

/**
 * The few things people change most, as rows: language, appearance, currency (main and optional second, in one picker), the converter
 * and the way into Notifications. Search and Buddgy can ask for the currency and converter sheets.
 */
export function PreferencesCard() {
  const copy = useSettingsHubCopy()
  const p = copy.page
  const { locale, setLocale } = useLocale()
  const { settings, rates, updateSettings } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, rates: s.exchangeRates, updateSettings: s.updateSettings })),
  )
  const base = useBaseCurrencySwitch()
  const sheet = useSettingsStore((s) => s.settingsSheet)
  const openSheet = useSettingsStore((s) => s.openSettingsSheet)

  const changeTheme = () => {
    const next = NEXT_THEME[settings.theme]
    updateSettings({ theme: next })
    applyTheme(next)
  }
  const second: Currency | null = settings.showSecondaryCurrency ? settings.secondaryCurrency : null
  const pickSecond = (code: string | null) =>
    updateSettings(code ? { secondaryCurrency: code as Currency, showSecondaryCurrency: true } : { showSecondaryCurrency: false, secondaryCurrency: settings.secondaryCurrency || defaultSecondCurrency(settings.baseCurrency) })
  const themeLabel = settings.theme === 'dark' ? copy.themeDark : settings.theme === 'light' ? copy.themeLight : p.themeSystem

  return (
    <>
      <SettingsSection title={p.preferences}>
        <SettingsRow icon={SETTING_ICONS.globe} tone={5} title={copy.language} value={locale === 'ar' ? 'العربية' : 'English'} onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} settingId="language" />
        <SettingsRow icon={SETTING_ICONS.sun} tone="neutral" title={p.appearance} value={themeLabel} onClick={changeTheme} settingId="theme" />
        <SettingsRow icon={SETTING_ICONS.coins} tone={1} title={copy.currencyTile} value={`${settings.baseCurrency}${second ? ` + ${second}` : ''}`} onClick={() => openSheet('currencies')} settingId="baseCurrency" />
        <SettingsRow icon={SETTING_ICONS.swap} tone={1} title={copy.convertTitle} onClick={() => openSheet('converter')} settingId="converter" />
        <SettingsRow icon={SETTING_ICONS.bell} tone={6} title={p.notifications} href="/settings/notifications" settingId="notifications" />
      </SettingsSection>

      <CurrencySheet
        dual
        open={sheet === 'currencies'}
        onClose={() => openSheet(null)}
        base={settings.baseCurrency}
        second={second}
        rates={rates}
        onPickMain={(code) => base.request(code as Currency)}
        onPickSecond={pickSecond}
        footer={<CentsRow />}
      />
      <BaseCurrencyChangeSheet from={settings.baseCurrency} to={base.pending} rates={rates} noRate={base.noRate} onConfirm={base.confirm} onCancel={base.cancel} />
      <ModalShell open={sheet === 'converter'} onBackdropClick={() => openSheet(null)} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
        <div className="flex flex-col gap-3">
          <V3SheetHeader title={copy.convertTitle} onClose={() => openSheet(null)} />
          <ConverterBody />
        </div>
      </ModalShell>
    </>
  )
}
