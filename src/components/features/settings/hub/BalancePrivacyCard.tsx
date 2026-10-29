'use client'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { isMasked, type PrivacySurface } from '@/lib/privacy/mask'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PrivacySettings } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

const SURFACES: PrivacySurface[] = ['hero', 'lists', 'notifications', 'buddgy']
type Preset = NonNullable<PrivacySettings['preset']>

/** Where hidden balances are masked: one preset, or each surface on its own. */
export function BalancePrivacyCard() {
  const t = useT().accountsPage
  const privacy = useFinanceStore((s) => s.settings.privacy)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const preset: Preset = privacy?.preset ?? 'off'
  const label: Record<PrivacySurface, string> = {
    hero: t.surfaceHero, lists: t.surfaceLists, notifications: t.surfaceNotifications, widgets: t.surfaceWidgets, buddgy: t.surfaceBuddgy,
  }
  const setPreset = (p: Preset) => updateSettings({ privacy: { ...privacy, preset: p } })
  const toggle = (s: PrivacySurface, on: boolean) => {
    const current = Object.fromEntries(SURFACES.map((k) => [k, isMasked(privacy, k)])) as Record<PrivacySurface, boolean>
    updateSettings({ privacy: { preset: 'custom', ...current, [s]: on } })
  }
  return (
    <SettingsSection title={t.privacyTitle}>
      <div className="space-y-3 px-4 py-3">
        <p className="text-xs text-[var(--color-brand-text-muted)]">{t.privacyHint}</p>
        <SegmentedControl ariaLabel={t.privacyTitle} value={preset} onChange={setPreset}
          options={[{ value: 'off', label: t.presetOff }, { value: 'hero', label: t.presetHero }, { value: 'all', label: t.presetAll }, { value: 'custom', label: t.presetCustom }]} />
      </div>
      {preset === 'custom' ? SURFACES.map((s) => (
        <label key={s} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{label[s]}</span>
          <Switch size="touch" aria-label={label[s]} checked={isMasked(privacy, s)} onCheckedChange={(on) => toggle(s, on)} />
        </label>
      )) : null}
    </SettingsSection>
  )
}
