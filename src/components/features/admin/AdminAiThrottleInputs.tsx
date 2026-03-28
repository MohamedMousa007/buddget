'use client'

import { Input } from '@/components/ui/input'
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
          <p className="text-sm text-white">Throttle per device (IP)</p>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">
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
          <Input
            type="number"
            min={1}
            max={1000}
            value={rateLimitMax}
            onChange={(e) => onRateLimitMax(Number(e.target.value))}
            className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--color-brand-text-secondary)] block mb-1">Window (seconds)</label>
          <Input
            type="number"
            min={1}
            max={3600}
            value={rateLimitWindowSec}
            onChange={(e) => onRateLimitWindowSec(Number(e.target.value))}
            className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
          />
        </div>
      </div>
    </>
  )
}
