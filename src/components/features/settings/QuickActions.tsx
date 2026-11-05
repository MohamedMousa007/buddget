'use client'

import { useState } from 'react'
import { ArrowLeftRight, Moon, Search, Sun, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { BaseCurrencyChangeSheet } from '@/components/features/settings/BaseCurrencyChangeSheet'
import { CurrencyConverter } from '@/components/features/settings/CurrencyConverter'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { IconButton } from '@/components/ui/IconButton'
import { Switch } from '@/components/ui/switch'
import { defaultSecondCurrency, useSettingToggle } from '@/hooks/useSettingToggle'
import { useBaseCurrencySwitch } from '@/hooks/useBaseCurrencySwitch'
import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { applyTheme } from '@/lib/theme/applyTheme'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { cn } from '@/lib/utils'
import type { Currency } from '@/lib/store/types'
import { ModalTitle } from '@/components/modals/ModalTitle'

interface TileProps {
  /** Glyph inside the button: an icon, or a short mark such as the language's initials. */
  children: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
  settingId?: string
}

/** One quick-settings button: a single glyph, named for assistive tech and as a tooltip. Filled teal when "on". */
function Tile({ children, label, active = false, onClick, settingId }: TileProps) {
  return (
    <button
      type="button"
      data-setting-id={settingId}
      data-raw-button-ok="quick-settings button: a compact glyph-only toggle, not a text button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl text-sm font-bold transition-colors active:scale-[0.96] [&_svg]:size-5',
        active
          ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
          : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-sunken)]',
      )}
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

/**
 * The few things people change most, as one row of tiles like a phone's quick settings: language, light or dark,
 * currencies (main and optional second, in one picker) and the converter. Shared by the settings page and the
 * profile menu; the `menu` variant is tighter.
 */
export function QuickActions({ variant, onSearch }: { variant: 'hub' | 'menu'; onSearch?: () => void }) {
  const copy = useSettingsHubCopy()
  const { locale, setLocale } = useLocale()
  const { settings, rates, updateSettings } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, rates: s.exchangeRates, updateSettings: s.updateSettings })),
  )
  const base = useBaseCurrencySwitch()
  const [localPicking, setLocalPicking] = useState(false)
  const [localConverting, setLocalConverting] = useState(false)
  const sheet = useSettingsStore((s) => s.settingsSheet)
  const openSheet = useSettingsStore((s) => s.openSettingsSheet)
  const hub = variant === 'hub'
  // On the settings page, search and Buddgy can ask for these sheets; the menu keeps its own.
  const picking = hub ? sheet === 'currencies' : localPicking
  const converting = hub ? sheet === 'converter' : localConverting
  const setPicking = (open: boolean) => (hub ? openSheet(open ? 'currencies' : null) : setLocalPicking(open))
  const setConverting = (open: boolean) => (hub ? openSheet(open ? 'converter' : null) : setLocalConverting(open))

  const dark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark'
    updateSettings({ theme: next })
    applyTheme(next)
  }
  const second: Currency | null = settings.showSecondaryCurrency ? settings.secondaryCurrency : null
  const pickSecond = (code: string | null) =>
    updateSettings(code ? { secondaryCurrency: code as Currency, showSecondaryCurrency: true } : { showSecondaryCurrency: false, secondaryCurrency: settings.secondaryCurrency || defaultSecondCurrency(settings.baseCurrency) })

  return (
    <>
      <div className={cn('flex gap-2', variant === 'menu' ? 'px-3 py-3' : 'p-3')} role="group" aria-label={copy.quickTitle}>
        <Tile settingId="language" label={`${copy.language}: ${locale === 'ar' ? 'العربية' : 'English'}`} onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
          <span className="font-mono-numbers">{locale === 'ar' ? 'ع' : 'EN'}</span>
        </Tile>
        <Tile settingId="theme" label={`${copy.theme}: ${dark ? copy.themeDark : copy.themeLight}`} active={dark} onClick={toggleTheme}>
          {dark ? <Moon /> : <Sun />}
        </Tile>
        <Tile settingId="baseCurrency" label={`${copy.currencyTile}: ${settings.baseCurrency}${second ? ` + ${second}` : ''}`} onClick={() => setPicking(true)}>
          <span className="font-mono-numbers">{settings.baseCurrency}</span>
        </Tile>
        <Tile settingId="converter" label={copy.convertTitle} onClick={() => setConverting(true)}>
          <ArrowLeftRight />
        </Tile>
        {onSearch ? (
          <Tile label={copy.searchLabel} onClick={onSearch}>
            <Search />
          </Tile>
        ) : null}
      </div>

      <CurrencySheet
        dual
        open={picking}
        onClose={() => setPicking(false)}
        base={settings.baseCurrency}
        second={second}
        rates={rates}
        onPickMain={(code) => base.request(code as Currency)}
        onPickSecond={pickSecond}
        footer={<CentsRow />}
      />
      <BaseCurrencyChangeSheet
        from={settings.baseCurrency}
        to={base.pending}
        rates={rates}
        noRate={base.noRate}
        onConfirm={base.confirm}
        onCancel={base.cancel}
      />
      <ModalShell open={converting} onBackdropClick={() => setConverting(false)} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <ModalTitle>{copy.convertTitle}</ModalTitle>
            <IconButton onClick={() => setConverting(false)} aria-label={copy.close} variant="tinted" size="sm" shape="round">
              <X className="h-full w-full" />
            </IconButton>
          </div>
          <ConverterBody />
        </div>
      </ModalShell>
    </>
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
