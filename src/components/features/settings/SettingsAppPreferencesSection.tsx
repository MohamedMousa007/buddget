'use client'

import { Palette } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsAppPreferencesSectionProps {
  store: FinanceStore
}

/**
 * Misc app toggles (e.g. dashboard cents).
 */
export function SettingsAppPreferencesSection({ store }: SettingsAppPreferencesSectionProps) {
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
    </section>
  )
}
