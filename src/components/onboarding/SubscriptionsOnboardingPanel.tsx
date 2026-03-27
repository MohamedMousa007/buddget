'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import type { Currency } from '@/lib/store/types'

export type SubscriptionLine = {
  id: string
  label: string
  amount: number
  currency: Currency
  enabled: boolean
}

export type SubscriptionsOnboardingPayload = {
  lines: SubscriptionLine[]
}

const PRESETS: { id: string; label: string }[] = [
  { id: 'netflix', label: 'Netflix' },
  { id: 'spotify', label: 'Spotify / Apple Music' },
  { id: 'icloud', label: 'iCloud / cloud storage' },
  { id: 'youtube', label: 'YouTube Premium' },
  { id: 'disney', label: 'Disney+ / streaming bundle' },
  { id: 'gym', label: 'Gym / fitness' },
  { id: 'sports', label: 'Sports / entertainment apps' },
  { id: 'gaming', label: 'Gaming / online subs' },
]

function defaultLines(baseCurrency: Currency): SubscriptionLine[] {
  return PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    amount: 0,
    currency: baseCurrency,
    enabled: false,
  }))
}

/** Build lines from saved answers or defaults (presets + any custom rows). */
export function subscriptionLinesFromSaved(raw: unknown, baseCurrency: Currency): SubscriptionLine[] {
  let initial: SubscriptionLine[] | undefined
  if (raw && typeof raw === 'object' && 'lines' in raw && Array.isArray((raw as { lines: unknown }).lines)) {
    initial = (raw as { lines: SubscriptionLine[] }).lines
  }
  if (!initial?.length) return defaultLines(baseCurrency)
  const byId = new Map(initial.map((l) => [l.id, l]))
  const merged = PRESETS.map((p) => {
    const hit = byId.get(p.id)
    return hit
      ? { ...hit, label: p.label }
      : { id: p.id, label: p.label, amount: 0, currency: baseCurrency, enabled: false }
  })
  const presetIds = new Set(PRESETS.map((x) => x.id))
  const customs = initial.filter((l) => !presetIds.has(l.id))
  return [...merged, ...customs]
}

export function SubscriptionsOnboardingPanel({
  lines,
  baseCurrency,
  onChange,
}: {
  lines: SubscriptionLine[]
  baseCurrency: Currency
  onChange: (p: SubscriptionsOnboardingPayload) => void
}) {
  const emit = (next: SubscriptionLine[]) => {
    onChange({ lines: next })
  }

  const addCustom = () => {
    emit([
      ...lines,
      {
        id: `custom_${Date.now()}`,
        label: '',
        amount: 0,
        currency: baseCurrency,
        enabled: true,
      },
    ])
  }

  const updatePreset = (id: string, patch: Partial<SubscriptionLine>) => {
    emit(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const removeCustom = (id: string) => {
    emit(lines.filter((l) => l.id !== id))
  }

  const enabledTotal = useMemo(
    () =>
      lines
        .filter((l) => l.enabled && l.amount > 0)
        .reduce((s, l) => s + l.amount, 0),
    [lines]
  )

  return (
    <div className="space-y-4 text-left w-full max-w-lg">
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">
        Toggle what you pay for, set a monthly amount and currency. Add your own line at the bottom.
      </p>

      <div className="grid gap-3">
        {lines
          .filter((l) => PRESETS.some((p) => p.id === l.id))
          .map((line) => (
            <div
              key={line.id}
              className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-3 space-y-2"
            >
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={line.enabled}
                  onChange={(e) => updatePreset(line.id, { enabled: e.target.checked })}
                  className="rounded border-[var(--color-brand-border)]"
                />
                <span>{line.label}</span>
              </label>
              {line.enabled ? (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div>
                    <Label className="text-[10px] text-[var(--color-brand-text-muted)]">Monthly / mo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={line.amount || ''}
                      onChange={(e) => updatePreset(line.id, { amount: parseFloat(e.target.value) || 0 })}
                      className="mt-0.5 h-9 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-[var(--color-brand-text-muted)]">Currency</Label>
                    <FiatCurrencySelect
                      value={line.currency}
                      onChange={(c) => updatePreset(line.id, { currency: c })}
                      className="mt-0.5 w-full h-9 px-2 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
      </div>

      {lines
        .filter((l) => !PRESETS.some((p) => p.id === l.id))
        .map((line) => (
          <div
            key={line.id}
            className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Input
                placeholder="Service name"
                value={line.label}
                onChange={(e) => updatePreset(line.id, { label: e.target.value.trimStart() })}
                className="flex-1 h-9 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white text-sm"
              />
              <button
                type="button"
                onClick={() => removeCustom(line.id)}
                className="text-xs text-[var(--color-brand-text-muted)] shrink-0"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={line.amount || ''}
                onChange={(e) => updatePreset(line.id, { amount: parseFloat(e.target.value) || 0 })}
                className="h-9 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers text-sm"
              />
              <FiatCurrencySelect
                value={line.currency}
                onChange={(c) => updatePreset(line.id, { currency: c })}
                className="h-9 px-2 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              />
            </div>
          </div>
        ))}

      <button
        type="button"
        onClick={addCustom}
        className="text-xs text-[var(--color-brand-red)] hover:underline"
      >
        + Add another service
      </button>

      <p className="text-[10px] text-[var(--color-brand-text-muted)]">
        Rough enabled total (not converted): {enabledTotal.toFixed(2)} (sum of entered amounts)
      </p>
    </div>
  )
}
