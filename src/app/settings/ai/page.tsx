'use client'

import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'

export default function SettingsAiPage() {
  const t = useT()
  const nudges = useSettingsStore((s) => s.buddgyNudges)
  const setNudges = useSettingsStore((s) => s.setBuddgyNudges)

  return (
    <SettingsSubPageShell title={t.buddgy.settingsTitle} showSave={false}>
      <Card padding="md" className="flex items-center gap-3">
        <span className="shrink-0 text-[var(--color-brand-text)]">
          <BuddgyIcon mood={nudges ? 'talking' : 'sleepy'} size={40} strokeWidth={1.75} filled alive />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{t.buddgy.tipsTitle}</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.buddgy.tipsHint}</p>
        </div>
        <Switch size="touch" aria-label={t.buddgy.tipsTitle} checked={nudges} onCheckedChange={setNudges} />
      </Card>
    </SettingsSubPageShell>
  )
}
