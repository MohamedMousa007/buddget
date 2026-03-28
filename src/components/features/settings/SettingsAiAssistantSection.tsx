'use client'

import { Bot, CheckCircle2, XCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsAiAssistantSectionProps {
  store: FinanceStore
  aiStatus: { enabled: boolean; model: string }
}

/**
 * Client AI toggle and server Gemini status readout.
 */
export function SettingsAiAssistantSection({ store, aiStatus }: SettingsAiAssistantSectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          AI Assistant
        </h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm text-white">Enable AI in app</Label>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            Toggle client preference (server still needs API keys)
          </p>
        </div>
        <Switch checked={store.settings.enableAI} onCheckedChange={(val) => store.updateSettings({ enableAI: val })} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white">Status</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Google Gemini (Server-side)</p>
        </div>
        <div className="flex items-center gap-2">
          {aiStatus.enabled ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-green)]" />
              <span className="text-sm text-[var(--color-brand-green)] font-medium">Active</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
              <span className="text-sm text-[var(--color-brand-text-muted)] font-medium">Not configured</span>
            </>
          )}
        </div>
      </div>

      {aiStatus.model ? (
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-brand-border)]">
          <span className="text-xs text-[var(--color-brand-text-muted)]">Model</span>
          <span className="text-xs font-mono-numbers text-[var(--color-brand-text-secondary)]">{aiStatus.model}</span>
        </div>
      ) : null}

      <p className="text-xs text-[var(--color-brand-text-muted)]">
        AI configuration is managed by the admin. Tap the chat bubble (bottom-right) to use the AI assistant.
      </p>
      <p className="text-[11px] text-[var(--color-brand-text-muted)] border-t border-[var(--color-brand-border)] pt-3">
        Free Gemini keys have a separate limit from Google (~20 requests/min). Admin &quot;Throttle per device&quot; only
        adds an optional cap in this app — it does not remove Google&apos;s quota. If you hit quota errors, wait, send
        fewer messages, or upgrade the key in Google AI Studio.
      </p>
    </section>
  )
}
