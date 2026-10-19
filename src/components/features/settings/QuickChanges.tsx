'use client'

import { useState } from 'react'
import { ChevronDown, Moon, Sun, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { BaseCurrencyChangeSheet } from '@/components/features/settings/BaseCurrencyChangeSheet'
import { CurrencyMark } from '@/components/ui/CurrencyMark'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Switch } from '@/components/ui/switch'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { defaultSecondCurrency } from '@/hooks/useSettingToggle'
import { useBaseCurrencySwitch } from '@/hooks/useBaseCurrencySwitch'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { applyTheme } from '@/lib/theme/applyTheme'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { AppSettings, Currency } from '@/lib/store/types'

type Theme = AppSettings['theme']

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
  const dark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const pickSecond = (code: string) => {
    updateSettings({ secondaryCurrency: code as Currency, showSecondaryCurrency: true })
    setPicking(null)
  }
  const pickMain = (code: string) => {
    setPicking(null)
    base.request(code as Currency)
  }
  return { settings, rates, base, second, picking, setPicking, setTheme, dark, updateSettings, pickSecond, pickMain }
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

interface QuickChangesProps {
  /** `card` fills the settings hub, `menu` is the profile popover, `currency` is the two currency rows alone. */
  variant: 'card' | 'currency' | 'menu'
}

function Row({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 ${compact ? 'min-h-12' : 'min-h-14'}`}>
      <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{label}</span>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  )
}

function CurrencyButton({ code, label, onClick }: { code: string | null; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="touch" aria-label={label} onClick={onClick} className="min-w-[7rem] justify-between px-3">
      <span className="flex items-center gap-2">
        {code ? <CurrencyMark code={code} /> : null}
        <span className={code ? 'font-mono-numbers font-bold' : 'font-medium text-[var(--color-brand-text-muted)]'}>{code ?? '+'}</span>
      </span>
      <ChevronDown className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />
    </Button>
  )
}

/**
 * The things people change most, one labelled row each so the controls line up: language, theme,
 * main currency, second currency. The hub and the profile popover share it, backed by the app's real
 * currency picker, language toggle and switch. Theme is a light/dark switch; "Auto" lives in Look.
 */
export function QuickChanges({ variant }: QuickChangesProps) {
  const copy = useSettingsHubCopy()
  const q = useQuickChanges()
  const { settings } = q
  const compact = variant === 'menu'
  const showApp = variant !== 'currency'

  return (
    <>
      <div className="divide-y divide-[var(--color-brand-border)]">
        {showApp ? (
          <Row label={copy.language} compact={compact}>
            <LanguageToggle compact />
          </Row>
        ) : null}
        {showApp ? (
          <Row label={copy.theme} compact={compact}>
            <Sun className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />
            <Switch size="touch" aria-label={`${copy.theme}: ${q.dark ? copy.themeDark : copy.themeLight}`} checked={q.dark} onCheckedChange={(on) => q.setTheme(on ? 'dark' : 'light')} />
            <Moon className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />
          </Row>
        ) : null}
        <Row label={copy.mainCurrency} compact={compact}>
          <CurrencyButton code={settings.baseCurrency} label={copy.mainCurrency} onClick={() => q.setPicking('main')} />
        </Row>
        <Row label={copy.secondCurrency} compact={compact}>
          <CurrencyButton code={q.second} label={copy.secondCurrency} onClick={() => q.setPicking('second')} />
          {q.second ? (
            <IconButton variant="ghost" shape="round" aria-label={copy.noSecond} onClick={() => q.updateSettings({ showSecondaryCurrency: false })}>
              <X />
            </IconButton>
          ) : null}
        </Row>
      </div>
      <Sheets q={q} />
    </>
  )
}
