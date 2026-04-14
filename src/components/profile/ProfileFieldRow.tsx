export interface ProfileFieldRowProps {
  label: string
  value: string
  /** Shown when `value` is empty (defaults to em dash). */
  emptyHint?: string
}

/**
 * Read-only label + value row for profile and account sections.
 */
export function ProfileFieldRow({ label, value, emptyHint }: ProfileFieldRowProps) {
  const show = value.trim()
  return (
    <div className="border-b border-[var(--color-brand-border)] pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <p className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)]">{label}</p>
      <p className="text-[var(--color-brand-text-primary)] text-sm mt-0.5">
        {show ? value : (emptyHint ?? '—')}
      </p>
    </div>
  )
}
