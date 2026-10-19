'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { applyTheme } from '@/lib/theme/applyTheme'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { AppSettings } from '@/lib/store/types'

type Theme = AppSettings['theme']

export default function SettingsLookPage() {
  const copy = useSettingsHubCopy()
  const theme = useFinanceStore((s) => s.settings.theme)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const setTheme = (next: Theme) => {
    updateSettings({ theme: next })
    applyTheme(next)
  }

  return (
    <SettingsSubPageShell title={copy.rooms.look.title}>
      <SettingsSection title={copy.lookPage.appearance}>
        <div data-setting-id="theme" className="space-y-2.5 px-4 py-3">
          <span className="block text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{copy.theme}</span>
          <SegmentedControl<Theme>
            ariaLabel={copy.theme}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: copy.themeLight, icon: <Sun /> },
              { value: 'system', label: copy.themeAuto, icon: <Monitor /> },
              { value: 'dark', label: copy.themeDark, icon: <Moon /> },
            ]}
          />
        </div>
      </SettingsSection>
      <SettingsSection title={copy.lookPage.text}>
        <div data-setting-id="language" className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{copy.language}</span>
            <span className="block text-xs text-[var(--color-brand-text-muted)]">{copy.lookPage.languageHint}</span>
          </span>
          <LanguageToggle />
        </div>
        <SettingsToggleRow id="showCents" tone={ROOM_TONE.look} hint={copy.lookPage.centsHint} />
      </SettingsSection>
    </SettingsSubPageShell>
  )
}
