'use client'

import { utilizationBarTone } from '@/lib/debt/computeCreditCardBalance'

function barClass(tone: ReturnType<typeof utilizationBarTone>): string {
  if (tone === 'green') return 'bg-[var(--color-brand-green)]'
  if (tone === 'amber') return 'bg-[var(--color-brand-amber)]'
  if (tone === 'red') return 'bg-[var(--color-brand-red)]'
  return 'bg-[var(--color-brand-text-muted)]'
}

export function CreditCardUtilizationBar({
  ratio,
  utilizationLabel,
}: {
  ratio: number | null
  utilizationLabel: string
}) {
  const tone = utilizationBarTone(ratio)
  const pct = ratio != null ? Math.min(100, Math.round(ratio * 100)) : 0
  if (ratio == null) return null
  return (
    <>
      <div className="h-2 bg-[var(--color-brand-border)] rounded-full overflow-hidden mt-2">
        <div className={`h-full rounded-full transition-all ${barClass(tone)}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">
        {pct}% {utilizationLabel}
      </p>
    </>
  )
}
