'use client'

export function AdminAiThrottlePresets({
  onRateLimitingEnabled,
  onRateLimitMax,
  onRateLimitWindowSec,
}: {
  onRateLimitingEnabled: (v: boolean) => void
  onRateLimitMax: (v: number) => void
  onRateLimitWindowSec: (v: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onRateLimitingEnabled(false)}
        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
      >
        Preset: no throttling
      </button>
      <button
        type="button"
        onClick={() => {
          onRateLimitingEnabled(true)
          onRateLimitMax(15)
          onRateLimitWindowSec(60)
        }}
        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
      >
        Preset: cautious (15 / 60s)
      </button>
      <button
        type="button"
        onClick={() => {
          onRateLimitingEnabled(true)
          onRateLimitMax(5)
          onRateLimitWindowSec(60)
        }}
        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
      >
        Preset: strict (5 / 60s)
      </button>
    </div>
  )
}
