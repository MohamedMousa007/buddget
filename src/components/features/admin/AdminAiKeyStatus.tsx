'use client'

import { Bot, CheckCircle2, XCircle } from 'lucide-react'
import type { AdminConfig } from '@/types/admin'

export interface AdminAiKeyStatusProps {
  config: AdminConfig | null
}

/**
 * Shows whether Gemini is configured (presence + model only — no key material).
 */
export function AdminAiKeyStatus({ config }: AdminAiKeyStatusProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Bot className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          AI Assistant
        </h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-[var(--color-brand-text-secondary)]">Status</span>
          <span className="flex items-center gap-2">
            {!config?.ai.keyPresent ? (
              <>
                <XCircle className="w-4 h-4 text-[var(--color-brand-red)]" />
                <span className="text-sm text-[var(--color-brand-red)] font-medium">No API key</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-green)]" />
                <span className="text-sm text-[var(--color-brand-green)] font-medium">Active</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-[var(--color-brand-border)]">
          <span className="text-sm text-[var(--color-brand-text-secondary)]">Model</span>
          <span className="text-sm font-mono-numbers text-[var(--color-brand-text-primary)]">{config?.ai.model || '—'}</span>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-[var(--color-brand-border)]">
          <span className="text-sm text-[var(--color-brand-text-secondary)]">API key on server</span>
          <span className="text-sm text-[var(--color-brand-text-muted)]">
            {config?.ai.keyPresent ? 'Configured' : 'Not set'}
          </span>
        </div>

        {!config?.ai.keyPresent ? (
          <div className="p-3 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)]">
            <p className="text-xs text-[var(--color-brand-text-secondary)]">
              To enable AI, add{' '}
              <code className="text-[var(--color-brand-red)] bg-[var(--color-brand-bg)] px-1 py-0.5 rounded">
                GEMINI_API_KEY
              </code>{' '}
              to your{' '}
              <code className="text-[var(--color-brand-red)] bg-[var(--color-brand-bg)] px-1 py-0.5 rounded">
                .env.local
              </code>{' '}
              file and restart the server.
            </p>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)] mt-2 inline-block"
            >
              Get a free Gemini API key →
            </a>
          </div>
        ) : null}
      </div>
    </>
  )
}
