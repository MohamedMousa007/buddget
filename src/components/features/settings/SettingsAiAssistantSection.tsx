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
          AI Money Assistant
        </h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm text-white">Turn on AI assistant</Label>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            Your preference — the server still needs a Gemini API key to work
          </p>
        </div>
        <Switch checked={store.settings.enableAI} onCheckedChange={(val) => store.updateSettings({ enableAI: val })} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white">Connection</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Google Gemini · server-side</p>
        </div>
        <div className="flex items-center gap-2">
          {aiStatus.enabled ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-green)]" />
              <span className="text-sm text-[var(--color-brand-green)] font-medium">Ready</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
              <span className="text-sm text-[var(--color-brand-text-muted)] font-medium">Not set up yet</span>
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
        Your admin manages the AI setup. Tap the chat bubble in the bottom-right corner to start chatting with your AI money assistant.
      </p>
      <p className="text-[11px] text-[var(--color-brand-text-muted)] border-t border-[var(--color-brand-border)] pt-3">
        Your Gemini API key has its own Google quota (~20 requests/min). The admin &quot;Throttle per device&quot; setting
        adds an extra cap inside Buddget — it doesn&apos;t change Google&apos;s limit. If you see quota errors, wait a moment,
        send fewer messages, or get your free key at Google AI Studio.
      </p>
    </section>
  )
}
