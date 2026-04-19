'use client'

import { useState } from 'react'
import { Download, Palette, Check, Monitor } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { IosInstallDialog } from '@/components/pwa/IosInstallDialog'
import { useT } from '@/lib/i18n'
import { applyTheme } from '@/lib/theme/applyTheme'
import { cn } from '@/lib/utils'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsAppPreferencesSectionProps {
  store: FinanceStore
}

type ThemeId = 'light' | 'dark' | 'system'

interface ThemePreset {
  id: ThemeId
  /** Preview swatch — a rounded square that shows the theme's card bg + accent. */
  card: string
  accent: string
  /** Leave undefined for single-swatch themes; "system" gets a conic gradient. */
  swatchStyle?: React.CSSProperties
}

const THEMES: ThemePreset[] = [
  {
    id: 'light',
    card: '#F5F4F0',
    accent: '#E50914',
  },
  {
    id: 'dark',
    card: '#0A0A0F',
    accent: '#E50914',
  },
  {
    id: 'system',
    card: '#FFFFFF',
    accent: '#E50914',
    swatchStyle: {
      background: 'conic-gradient(from 45deg, #F5F4F0 0deg 180deg, #0A0A0F 180deg 360deg)',
    },
  },
]

export function SettingsAppPreferencesSection({ store }: SettingsAppPreferencesSectionProps) {
  const t = useT()
  const { platform, canInstall, isInstalled, triggerInstall } = usePWAInstall()
  const [iosOpen, setIosOpen] = useState(false)

  const handleThemeChange = (value: ThemeId) => {
    store.updateSettings({ theme: value })
    applyTheme(value)
  }

  const themeLabel = (id: ThemeId): string => {
    if (id === 'light') return t.settings.themeNamePaper
    if (id === 'dark') return t.settings.themeNameMidnight
    return t.settings.themeSystem
  }

  return (
    <section className="glass-card rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Palette className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.settings.lookFeelTitle}
        </h2>
      </div>

      <div>
        <Label className="text-sm text-[var(--color-brand-text-primary)]">
          {t.settings.themeLabel}
        </Label>
        <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
          {t.settings.themePickerHint}
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {THEMES.map((preset) => {
            const selected = store.settings.theme === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleThemeChange(preset.id)}
                className="flex flex-col items-center gap-1.5 focus:outline-none"
                aria-pressed={selected}
              >
                <span
                  className={cn(
                    'relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all',
                    selected
                      ? 'border-[var(--color-brand-red)] ring-2 ring-[var(--color-brand-red)]/30'
                      : 'border-[var(--color-brand-border)] hover:border-[var(--color-brand-text-muted)]',
                  )}
                  style={preset.swatchStyle ?? { background: preset.card }}
                  aria-hidden
                >
                  {preset.id === 'system' ? (
                    <Monitor className="w-4 h-4 text-[var(--color-brand-text-primary)]/70" />
                  ) : (
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ background: preset.accent }}
                    />
                  )}
                  {selected ? (
                    <span className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-[var(--color-brand-red)] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-[11px]',
                    selected
                      ? 'text-[var(--color-brand-text-primary)] font-medium'
                      : 'text-[var(--color-brand-text-secondary)]',
                  )}
                >
                  {themeLabel(preset.id)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm text-[var(--color-brand-text-primary)]">
          {t.settings.languageLabel}
        </Label>
        <LanguageToggle size="sm" />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm text-[var(--color-brand-text-primary)]">
          {t.settings.showCents}
        </Label>
        <Switch
          checked={store.settings.showCentsInDashboard}
          onCheckedChange={(val) => store.updateSettings({ showCentsInDashboard: val })}
        />
      </div>

      <div className="pt-2 border-t border-[var(--color-brand-border)]">
        <p className="text-xs text-[var(--color-brand-text-muted)] mb-2">
          {t.settings.desktopApp}
        </p>
        {isInstalled ? (
          <p className="text-sm font-medium text-emerald-400">{t.settings.appInstalled}</p>
        ) : platform === 'ios' ? (
          <>
            <button
              type="button"
              onClick={() => setIosOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              {t.pwa.installApp}
            </button>
            <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
          </>
        ) : canInstall ? (
          <button
            type="button"
            onClick={() => void triggerInstall()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            {platform === 'desktop' ? t.settings.installDesktop : t.pwa.installApp}
          </button>
        ) : platform === 'android' ? (
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            {t.settings.installAndroidHint}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
            {t.settings.installUnavailableBrowser}
          </p>
        )}
      </div>
    </section>
  )
}
