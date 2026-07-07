'use client'

import type { AdminConfig } from '@/types/admin'

export function AdminAiThrottleFooter({
  config,
  sessionPin,
  saveLoading,
  saveMessage,
  onSave,
}: {
  config: AdminConfig | null
  sessionPin: string
  saveLoading: boolean
  saveMessage: string
  onSave: () => void
}) {
  return (
    <>
      {config?.ai.runtime ? (
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          <span className="text-[var(--color-brand-text-secondary)]">Currently applied:</span>{' '}
          {config.ai.runtime.effective.rateLimitingEnabled
            ? `throttling on — ${config.ai.runtime.effective.rateLimitMaxRequests} req / ${Math.round(config.ai.runtime.effective.rateLimitWindowMs / 1000)}s per device`
            : 'no server-side throttling (Gemini limits only)'}
          {JSON.stringify(config.ai.runtime.stored) !== JSON.stringify(config.ai.runtime.effective)
            ? ' — env overrides differ from saved file (see banner)'
            : ''}
        </p>
      ) : null}

      <button
        type="button"
        disabled={saveLoading || !sessionPin}
        onClick={() => void onSave()}
        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold disabled:opacity-50"
      >
        {saveLoading ? 'Saving…' : 'Save throttling settings'}
      </button>
      {saveMessage ? (
        <p
          className={`text-xs ${saveMessage === 'Saved.' ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}`}
        >
          {saveMessage}
        </p>
      ) : null}
      <p className="text-[10px] text-[var(--color-brand-text-muted)]">
        Settings file: <code className="text-[var(--color-brand-text-secondary)]">data/ai-runtime-config.json</code>
        {config?.ai.runtime.persistedToDisk ? ' (exists)' : ' (created on first save)'}. On serverless hosts without a
        persistent disk, use{' '}
        <code className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMITING_ENABLED</code>,{' '}
        <code className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMIT_MAX</code>,{' '}
        <code className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMIT_WINDOW_MS</code>.
      </p>
    </>
  )
}
