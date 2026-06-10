interface Props {
  rows?: number
  className?: string
}

/** Pulse-skeleton list used while `dataReady === false` to prevent stale data flash. */
export function SkeletonList({ rows = 5, className = '' }: Props) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-2xl bg-[var(--color-brand-elevated)] animate-pulse border border-[var(--color-brand-border)]"
        />
      ))}
    </div>
  )
}
