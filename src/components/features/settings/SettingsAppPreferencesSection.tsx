'use client'

import { Palette, Check, Monitor } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { useT } from '@/lib/i18n'
import { applyTheme } from '@/lib/theme/applyTheme'
import { cn } from '@/lib/utils'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsAppPreferencesSectionProps {
  store: FinanceStore
}

type PaletteId = 'light' | 'dark' | 'system'
type LayoutId = 'standard' | 'minimal'

interface ThemePreset {
  /** Picker-local identifier (renders the swatch + label). */
  id: string
  /** Underlying palette written to `settings.theme`. */
  palette: PaletteId
  /** Underlying dashboard layout written to `settings.dashboardLayout`. */
  layout: LayoutId
  labelKey: 'themeNamePaper' | 'themeNameMidnight' | 'themeNameMinimal' | 'themeSystem'
  /** Card colour — used as the swatch background for non-system presets. */
  card: string
  /** Accent glyph colour rendered as a small dot in the swatch centre. */
  accent: string
  /** System swatch uses a conic gradient instead of a solid fill. */
  swatchStyle?: React.CSSProperties
  /** When true, the swatch gets a thin horizontal line across the middle
   *  to hint at the minimal-stack layout. */
  minimalMark?: boolean
}

const THEMES: ThemePreset[] = [
  { id: 'paper',    palette: 'light',  layout: 'standard', labelKey: 'themeNamePaper',    card: '#F5F4F0', accent: '#E50914' },
  { id: 'midnight', palette: 'dark',   layout: 'standard', labelKey: 'themeNameMidnight', card: '#0A0A0F', accent: '#E50914' },
  {
    id: 'minimal',
    palette: 'light',
    layout: 'minimal',
    labelKey: 'themeNameMinimal',
    card: '#FFFFFF',
    accent: '#0A0A0F',
    minimalMark: true,
  },
  {
    id: 'system',
    palette: 'system',
    layout: 'standard',
    labelKey: 'themeSystem',
    card: '#FFFFFF',
    accent: '#E50914',
    swatchStyle: {
      background: 'conic-gradient(from 45deg, #F5F4F0 0deg 180deg, #0A0A0F 180deg 360deg)',
    },
  },
]

export function SettingsAppPreferencesSection({ store }: SettingsAppPreferencesSectionProps) {
  const t = useT()

  const currentLayout: LayoutId = store.settings.dashboardLayout ?? 'standard'
  const currentPalette: PaletteId = store.settings.theme

  const handleSelect = (preset: ThemePreset) => {
    store.updateSettings({ theme: preset.palette, dashboardLayout: preset.layout })
    applyTheme(preset.palette)
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
            const selected =
              preset.palette === currentPalette && preset.layout === currentLayout
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelect(preset)}
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
                  {preset.palette === 'system' ? (
                    <Monitor className="w-4 h-4 text-[var(--color-brand-text-primary)]/70" />
                  ) : preset.minimalMark ? (
                    <span
                      className="absolute inset-x-[18%] h-[2px] rounded-full"
                      style={{ background: preset.accent }}
                    />
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
                  {t.settings[preset.labelKey]}
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

    </section>
  )
}
