'use client'

import { Download, Palette } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsAppPreferencesSectionProps {
  store: FinanceStore
}

export function SettingsAppPreferencesSection({ store }: SettingsAppPreferencesSectionProps) {
  const { platform, canInstall, isInstalled, triggerInstall } = usePWAInstall()

  const showInstallRow = isInstalled || (platform === 'desktop' && canInstall)

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Palette className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">App</h2>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm text-white">Show cents in dashboard</Label>
        <Switch
          checked={store.settings.showCentsInDashboard}
          onCheckedChange={(val) => store.updateSettings({ showCentsInDashboard: val })}
        />
      </div>

      {showInstallRow ? (
        <div className="pt-2 border-t border-[var(--color-brand-border)]">
          <p className="text-xs text-[var(--color-brand-text-muted)] mb-2">Desktop app</p>
          {isInstalled ? (
            <p className="text-sm font-medium text-emerald-400">App installed ✓</p>
          ) : (
            <button
              type="button"
              onClick={() => void triggerInstall()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              Install Buddget as Desktop App
            </button>
          )}
        </div>
      ) : null}
    </section>
  )
}
