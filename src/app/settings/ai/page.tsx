'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { IconButton } from '@/components/ui/IconButton'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { migrateLegacyNotes } from '@/lib/ai/memoryActions'

export default function SettingsAiPage() {
  const t = useT()
  const nudges = useSettingsStore((s) => s.buddgyNudges)
  const setNudges = useSettingsStore((s) => s.setBuddgyNudges)
  const learning = useSettingsStore((s) => s.buddgyLearning)
  const setLearning = useSettingsStore((s) => s.setBuddgyLearning)
  const memories = useFinanceStore((s) => s.buddgyMemories)
  const forget = useFinanceStore((s) => s.removeBuddgyMemory)

  useEffect(migrateLegacyNotes, [])

  return (
    <SettingsSubPageShell title={t.buddgy.settingsTitle} backHref="/settings/buddgy">
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

      <Card padding="md" className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{t.buddgy.learningTitle}</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.buddgy.learningHint}</p>
        </div>
        <Switch size="touch" aria-label={t.buddgy.learningTitle} checked={learning} onCheckedChange={setLearning} />
      </Card>

      <Card padding="md" className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{t.buddgy.memoriesTitle}</p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">{t.buddgy.memoriesHint}</p>
        {memories.length === 0 ? (
          <p className="text-sm text-[var(--color-brand-text-muted)]">{t.buddgy.memoriesEmpty}</p>
        ) : (
          <ul className="flex flex-col">
            {memories.map((m) => (
              <li key={m.id} className="flex items-center gap-2 border-t border-[var(--color-brand-border)] py-1">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-[var(--color-brand-text-primary)]">{m.text}</span>
                  <span className="block text-xs text-[var(--color-brand-text-muted)]">
                    {t.buddgy.memorySource[m.source]} · {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <IconButton onClick={() => forget(m.id)} aria-label={t.buddgy.forget} size="sm" shape="round">
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </SettingsSubPageShell>
  )
}
