'use client'

/** Shown while Recharts-based charts load (client-only dynamic import). */
export function ChartPlaceholder() {
  return (
    <div
      className="h-[300px] rounded-xl bg-[var(--color-brand-elevated)] animate-pulse border border-[var(--color-brand-border)]"
      aria-hidden
    />
  )
}
