'use client'

import { useState } from 'react'
import { ArrowLeftRight, Coins, Languages, Moon, Sun, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { BaseCurrencyChangeSheet } from '@/components/features/settings/BaseCurrencyChangeSheet'
import { CurrencyConverter } from '@/components/features/settings/CurrencyConverter'
import { CurrencyDualSheet } from '@/components/ui/CurrencyDualSheet'
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

interface TileProps {
  compact?: boolean
  icon: React.ReactNode
  label: string
  state: string
  active?: boolean
  onClick: () => void
  settingId?: string
}

/** One quick-settings tile: glyph on top, name, current state. Filled teal when it is "on". */
function Tile({ icon, label, state, active = false, onClick, settingId, compact = false }: TileProps) {
  return (
    <button
      type="button"
      data-setting-id={settingId}
      data-raw-button-ok="quick-settings tile: a square toggle-style control, not a text button"
      onClick={onClick}
      className={cn(
        'flex min-h-[76px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-center transition-colors active:scale-[0.97]',
        compact ? 'px-0.5' : 'px-1.5',
        active
          ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
          : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-sunken)]',
      )}
    >
      <span className="flex size-6 items-center justify-center [&_svg]:size-5">{icon}</span>
      <span className={cn('max-w-full truncate font-semibold leading-tight', compact ? 'text-[10.5px]' : 'text-[11px]')}>{label}</span>
      <span className={cn('font-mono-numbers max-w-full truncate text-[10px] leading-tight', active ? 'opacity-85' : 'text-[var(--color-brand-text-muted)]')}>{state}</span>
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
export function QuickActions({ variant }: { variant: 'hub' | 'menu' }) {
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
        <Tile
          compact={variant === 'menu'}
          settingId="language"
          icon={<Languages />}
          label={copy.language}
          state={locale === 'ar' ? 'العربية' : 'English'}
          onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
        />
        <Tile
          compact={variant === 'menu'}
          settingId="theme"
          icon={dark ? <Moon /> : <Sun />}
          label={copy.theme}
          state={dark ? copy.themeDark : copy.themeLight}
          active={dark}
          onClick={toggleTheme}
        />
        <Tile
          compact={variant === 'menu'}
          settingId="baseCurrency"
          icon={<Coins />}
          label={copy.currencyTile}
          state={second ? `${settings.baseCurrency} + ${second}` : settings.baseCurrency}
          onClick={() => setPicking(true)}
        />
        <Tile compact={variant === 'menu'} settingId="converter" icon={<ArrowLeftRight />} label={copy.convertTile} state={copy.convertHint} onClick={() => setConverting(true)} />
      </div>

      <CurrencyDualSheet
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
            <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{copy.convertTitle}</h2>
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
  const store = useFinanceStore()
  return <CurrencyConverter store={store} />
}
