'use client'

import { useState } from 'react'
import { ArrowLeftRight, Monitor, Moon, Sun } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { BaseCurrencyChangeSheet } from '@/components/features/settings/BaseCurrencyChangeSheet'
import { CurrencyMark } from '@/components/ui/CurrencyMark'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { IconButton } from '@/components/ui/IconButton'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { defaultSecondCurrency } from '@/hooks/useSettingToggle'
import { useBaseCurrencySwitch } from '@/hooks/useBaseCurrencySwitch'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { applyTheme } from '@/lib/theme/applyTheme'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { AppSettings, Currency } from '@/lib/store/types'

type Theme = AppSettings['theme']
const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

interface QuickChangesProps {
  /** `card` fills the settings hub, `currency` is its currency half alone, `menu` is the one-row strip in the profile popover. */
  variant: 'card' | 'currency' | 'menu'
}

function useQuickChanges() {
  const { settings, rates, updateSettings } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, rates: s.exchangeRates, updateSettings: s.updateSettings })),
  )
  const base = useBaseCurrencySwitch()
  const [picking, setPicking] = useState<'main' | 'second' | null>(null)

  const second: Currency | null = settings.showSecondaryCurrency ? settings.secondaryCurrency : null
  const setTheme = (theme: Theme) => {
    updateSettings({ theme })
    applyTheme(theme)
  }
  const swap = () => {
    if (!second) return
    base.request(second)
  }
  const pickSecond = (code: string) => {
    updateSettings({ secondaryCurrency: code as Currency, showSecondaryCurrency: true })
    setPicking(null)
  }
  const pickMain = (code: string) => {
    setPicking(null)
    base.request(code as Currency)
  }
  return { settings, rates, base, second, picking, setPicking, setTheme, swap, pickSecond, pickMain }
}

function Sheets({ q }: { q: ReturnType<typeof useQuickChanges> }) {
  const { settings } = q
  return (
    <>
      <CurrencySheet
        open={q.picking === 'main'}
        value={settings.baseCurrency}
        base={settings.baseCurrency}
        onSelect={q.pickMain}
        onClose={() => q.setPicking(null)}
        zIndexClassName="z-[110]"
      />
      <CurrencySheet
        open={q.picking === 'second'}
        value={q.second ?? defaultSecondCurrency(settings.baseCurrency)}
        base={settings.baseCurrency}
        codes={FIAT_CURRENCIES.filter((c) => c !== settings.baseCurrency)}
        onSelect={q.pickSecond}
        onClose={() => q.setPicking(null)}
        zIndexClassName="z-[110]"
      />
      <BaseCurrencyChangeSheet
        from={settings.baseCurrency}
        to={q.base.pending}
        rates={q.rates}
        noRate={q.base.noRate}
        onConfirm={q.base.confirm}
        onCancel={q.base.cancel}
      />
    </>
  )
}

/**
 * The things people change most: main and second currency, language, theme. The same
 * controls sit on the settings hub and in the profile popover, both backed by the app's
 * real currency picker, language toggle and segmented control.
 */
export function QuickChanges({ variant }: QuickChangesProps) {
  const copy = useSettingsHubCopy()
  const q = useQuickChanges()
  const { settings } = q
  const theme = settings.theme

  const themeLabel = { light: copy.themeLight, dark: copy.themeDark, system: copy.themeAuto }
  const themeIcon = { light: <Sun />, dark: <Moon />, system: <Monitor /> }

  if (variant === 'menu') {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3 pt-3">
          <OptionChip size="md" selected={false} onClick={() => q.setPicking('main')} aria-label={copy.mainCurrency}>
            <span className="font-mono-numbers font-bold">{settings.baseCurrency}</span>
          </OptionChip>
          <OptionChip
            size="md"
            selected={q.second !== null}
            onClick={() => q.setPicking('second')}
            aria-label={copy.alsoShow}
            title={copy.alsoShow}
          >
            <span className="font-mono-numbers font-bold">{q.second ? `+ ${q.second}` : '+'}</span>
          </OptionChip>
          <LanguageToggle compact className="ms-auto" />
          <IconButton
            variant="tinted"
            aria-label={`${copy.theme}: ${themeLabel[theme]}`}
            onClick={() => q.setTheme(next)}
          >
            {themeIcon[theme]}
          </IconButton>
        </div>
        <Sheets q={q} />
      </>
    )
  }

  return (
    <>
      <div className="space-y-3 p-4">
        {variant === 'card' ? (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{copy.quickTitle}</p>
        ) : null}
        <div className="flex items-center gap-2">
          <SelectableCard as="action" layout="list" className="min-h-14 min-w-0 flex-1 gap-2.5 px-3" onClick={() => q.setPicking('main')} aria-label={copy.mainCurrency}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[11px] font-bold text-[var(--color-brand-primary-ink)]">
              <CurrencyMark code={settings.baseCurrency} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] leading-tight text-[var(--color-brand-text-muted)]">{copy.mainShort}</span>
              <span className="font-mono-numbers block text-[15px] font-bold leading-tight">{settings.baseCurrency}</span>
            </span>
          </SelectableCard>
          <IconButton
            variant="outlined"
            size="md"
            aria-label={copy.swap}
            disabled={!q.second}
            onClick={q.swap}
          >
            <ArrowLeftRight />
          </IconButton>
          <SelectableCard as="action" layout="list" className="min-h-14 min-w-0 flex-1 gap-2.5 px-3" onClick={() => q.setPicking('second')} aria-label={copy.alsoShow}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-sunken)] text-[11px] font-bold text-[var(--color-brand-text-secondary)]">
              {q.second ? <CurrencyMark code={q.second} /> : '+'}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] leading-tight text-[var(--color-brand-text-muted)]">{copy.secondShort}</span>
              <span className={cn('block truncate text-[15px] font-bold leading-tight', q.second && 'font-mono-numbers')}>{q.second ?? copy.addSecond}</span>
            </span>
          </SelectableCard>
        </div>
        {variant === 'card' ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{copy.language}</span>
              <LanguageToggle compact />
            </div>
            <SegmentedControl<Theme>
              ariaLabel={copy.theme}
              value={theme}
              onChange={q.setTheme}
              options={THEME_ORDER.map((value) => ({ value, label: themeLabel[value], icon: themeIcon[value] }))}
            />
          </>
        ) : null}
      </div>
      <Sheets q={q} />
    </>
  )
}
