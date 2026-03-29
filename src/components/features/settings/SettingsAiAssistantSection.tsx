'use client'

import { Bot, CheckCircle2, XCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/lib/i18n'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsAiAssistantSectionProps {
  store: FinanceStore
  aiStatus: { enabled: boolean; model: string }
}

/**
 * Client AI toggle and server Gemini status readout.
 */
export function SettingsAiAssistantSection({ store, aiStatus }: SettingsAiAssistantSectionProps) {
  const t = useT()

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.settings.aiTitle}
        </h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm text-white">{t.settings.aiToggle}</Label>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            {t.settings.aiToggleHint}
          </p>
        </div>
        <Switch checked={store.settings.enableAI} onCheckedChange={(val) => store.updateSettings({ enableAI: val })} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white">{t.settings.aiConnection}</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.settings.aiConnectionSub}</p>
        </div>
        <div className="flex items-center gap-2">
          {aiStatus.enabled ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-green)]" />
              <span className="text-sm text-[var(--color-brand-green)] font-medium">{t.settings.aiReady}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
              <span className="text-sm text-[var(--color-brand-text-muted)] font-medium">{t.settings.aiNotSetUp}</span>
            </>
          )}
        </div>
      </div>

      {aiStatus.model ? (
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-brand-border)]">
          <span className="text-xs text-[var(--color-brand-text-muted)]">{t.settings.aiModel}</span>
          <span className="text-xs font-mono-numbers text-[var(--color-brand-text-secondary)]">{aiStatus.model}</span>
        </div>
      ) : null}

      <p className="text-xs text-[var(--color-brand-text-muted)]">
        {t.settings.aiFooter1}
      </p>
      <p className="text-[11px] text-[var(--color-brand-text-muted)] border-t border-[var(--color-brand-border)] pt-3">
        {t.settings.aiFooter2}
      </p>
    </section>
  )
}
