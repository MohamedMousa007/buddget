'use client'

import { AmountField } from '@/components/ui/AmountField'
import { Switch } from '@/components/ui/switch'

export function AdminAiThrottleInputs({
  rateLimitingEnabled,
  onRateLimitingEnabled,
  rateLimitMax,
  onRateLimitMax,
  rateLimitWindowSec,
  onRateLimitWindowSec,
}: {
  rateLimitingEnabled: boolean
  onRateLimitingEnabled: (v: boolean) => void
  rateLimitMax: number
  onRateLimitMax: (v: number) => void
  rateLimitWindowSec: number
  onRateLimitWindowSec: (v: number) => void
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 py-2">
        <div>
          <p className="text-sm text-[var(--color-brand-text-primary)]">Throttle per device (IP)</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            Turn off for solo use; turn on to limit what each visitor can send to Gemini through your server.
          </p>
        </div>
        <Switch checked={rateLimitingEnabled} onCheckedChange={onRateLimitingEnabled} />
      </div>

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${!rateLimitingEnabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div>
          <label className="text-xs text-[var(--color-brand-text-secondary)] block mb-1">
            Max requests / window (per device)
          </label>
          <AmountField
            mode="integer"
            value={String(rateLimitMax)}
            onChange={(v) => onRateLimitMax(Number(v))}
            className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--color-brand-text-secondary)] block mb-1">Window (seconds)</label>
          <AmountField
            mode="integer"
            value={String(rateLimitWindowSec)}
            onChange={(v) => onRateLimitWindowSec(Number(v))}
            className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
        </div>
      </div>
    </>
  )
}
