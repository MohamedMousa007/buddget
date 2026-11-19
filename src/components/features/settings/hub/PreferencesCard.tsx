'use client'

import { ArrowLeftRight, Moon, Monitor, Search, Sun } from 'lucide-react'
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

interface TileProps {
  /** Glyph inside the button: an icon, or a short mark such as the language's initials. */
  children: React.ReactNode
  /** Names the tile and its current value for assistive tech and as a tooltip. */
  label: string
  onClick: () => void
  settingId?: string
}

/** One quick-settings button: a single glyph, named for assistive tech and as a tooltip. */
function Tile({ children, label, onClick, settingId }: TileProps) {
  return (
    <button
      type="button"
      data-setting-id={settingId}
      data-raw-button-ok="quick-settings button: a compact glyph-only toggle, not a text button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl bg-[var(--color-brand-elevated)] text-sm font-bold text-[var(--color-brand-text-primary)] transition-colors hover:bg-[var(--color-brand-sunken)] active:scale-[0.96] [&_svg]:size-5"
    >
      {children}
    </button>
  )
}

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
 * The few things people change most, as one row of glyph tiles like a phone's quick settings: language, appearance (light, dark, system),
 * currencies (main and optional second, in one picker), the converter and search; Notifications is the labelled row under it.
 * Search and Buddgy can ask for the currency and converter sheets.
 */
export function PreferencesCard({ onSearch }: { onSearch: () => void }) {
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
        <div className="flex gap-2 p-3" role="group" aria-label={copy.quickTitle}>
          <Tile settingId="language" label={`${copy.language}: ${locale === 'ar' ? 'العربية' : 'English'}`} onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
            <span className="font-mono-numbers">{locale === 'ar' ? 'ع' : 'EN'}</span>
          </Tile>
          <Tile settingId="theme" label={`${p.appearance}: ${themeLabel}`} onClick={changeTheme}>
            {settings.theme === 'dark' ? <Moon /> : settings.theme === 'light' ? <Sun /> : <Monitor />}
          </Tile>
          <Tile settingId="baseCurrency" label={`${copy.currencyTile}: ${settings.baseCurrency}${second ? ` + ${second}` : ''}`} onClick={() => openSheet('currencies')}>
            <span className="font-mono-numbers">{settings.baseCurrency}</span>
          </Tile>
          <Tile settingId="converter" label={copy.convertTitle} onClick={() => openSheet('converter')}>
            <ArrowLeftRight />
          </Tile>
          <Tile label={copy.searchLabel} onClick={onSearch}>
            <Search />
          </Tile>
        </div>
        <SettingsRow icon={SETTING_ICONS.bell} tone={3} solid title={p.notifications} href="/settings/notifications" settingId="notifications" />
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
