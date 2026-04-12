'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n/types'
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

export function subscriptionPresetsFromDictionary(t: Dictionary): { id: string; label: string }[] {
  const o = t.onboarding
  return [
    { id: 'netflix', label: o.subscriptionNetflix },
    { id: 'spotify', label: o.subscriptionSpotify },
    { id: 'icloud', label: o.subscriptionIcloud },
    { id: 'youtube', label: o.subscriptionYoutube },
    { id: 'disney', label: o.subscriptionDisney },
    { id: 'gym', label: o.subscriptionGym },
    { id: 'sports', label: o.subscriptionSports },
    { id: 'gaming', label: o.subscriptionGaming },
  ]
}

function defaultLines(baseCurrency: Currency, t: Dictionary): SubscriptionLine[] {
  return subscriptionPresetsFromDictionary(t).map((p) => ({
    id: p.id,
    label: p.label,
    amount: 0,
    currency: baseCurrency,
    enabled: false,
  }))
}

/** Build lines from saved answers or defaults (presets + any custom rows). */
export function subscriptionLinesFromSaved(
  raw: unknown,
  baseCurrency: Currency,
  t: Dictionary
): SubscriptionLine[] {
  const presets = subscriptionPresetsFromDictionary(t)
  let initial: SubscriptionLine[] | undefined
  if (raw && typeof raw === 'object' && 'lines' in raw && Array.isArray((raw as { lines: unknown }).lines)) {
    initial = (raw as { lines: SubscriptionLine[] }).lines
  }
  if (!initial?.length) return defaultLines(baseCurrency, t)
  const byId = new Map(initial.map((l) => [l.id, l]))
  const merged = presets.map((p) => {
    const hit = byId.get(p.id)
    return hit
      ? { ...hit, label: p.label }
      : { id: p.id, label: p.label, amount: 0, currency: baseCurrency, enabled: false }
  })
  const presetIds = new Set(presets.map((x) => x.id))
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
  const t = useT()
  const o = t.onboarding
  const presets = useMemo(() => subscriptionPresetsFromDictionary(t), [t])

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

  const updateLine = (id: string, patch: Partial<SubscriptionLine>) => {
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

  const presetIdSet = useMemo(() => new Set(presets.map((p) => p.id)), [presets])

  return (
    <div className="space-y-4 text-start w-full max-w-lg">
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">{o.subscriptionIntro}</p>

      <div className="grid gap-3">
        {lines
          .filter((l) => presetIdSet.has(l.id))
          .map((line) => (
            <div
              key={line.id}
              className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-3 space-y-2"
            >
              <label className="flex items-center gap-2 text-sm text-[var(--color-brand-text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={line.enabled}
                  onChange={(e) => updateLine(line.id, { enabled: e.target.checked })}
                  className="rounded border-[var(--color-brand-border)]"
                />
                <span>{line.label}</span>
              </label>
              {line.enabled ? (
                <div className="grid grid-cols-2 gap-2 ps-6">
                  <div>
                    <Label className="text-[10px] text-[var(--color-brand-text-muted)]">
                      {o.subscriptionMonthlyCost}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={line.amount || ''}
                      onChange={(e) => updateLine(line.id, { amount: parseFloat(e.target.value) || 0 })}
                      className="mt-0.5 h-9 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-[var(--color-brand-text-muted)]">
                      {o.subscriptionCurrency}
                    </Label>
                    <FiatCurrencySelect
                      value={line.currency}
                      onChange={(c) => updateLine(line.id, { currency: c })}
                      className="mt-0.5 w-full h-9 px-2 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
      </div>

      {lines
        .filter((l) => !presetIdSet.has(l.id))
        .map((line) => (
          <div
            key={line.id}
            className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Input
                placeholder={o.subscriptionCustomPlaceholder}
                value={line.label}
                onChange={(e) => updateLine(line.id, { label: e.target.value.trimStart() })}
                className="flex-1 h-9 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
              />
              <button
                type="button"
                onClick={() => removeCustom(line.id)}
                className="text-xs text-[var(--color-brand-text-muted)] shrink-0"
              >
                {t.common.remove}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.01"
                placeholder={o.subscriptionAmountPlaceholder}
                value={line.amount || ''}
                onChange={(e) => updateLine(line.id, { amount: parseFloat(e.target.value) || 0 })}
                className="h-9 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers text-sm"
              />
              <FiatCurrencySelect
                value={line.currency}
                onChange={(c) => updateLine(line.id, { currency: c })}
                className="h-9 px-2 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
              />
            </div>
          </div>
        ))}

      <button
        type="button"
        onClick={addCustom}
        className="text-xs text-[var(--color-brand-red)] hover:underline"
      >
        {o.subscriptionAddAnother}
      </button>

      <p className="text-[10px] text-[var(--color-brand-text-muted)]">
        {o.subscriptionTotal(enabledTotal.toFixed(2))}
      </p>
    </div>
  )
}
