export interface ProfileFieldRowProps {
  label: string
  value: string
}

/**
 * Read-only label + value row for profile and account sections.
 */
export function ProfileFieldRow({ label, value }: ProfileFieldRowProps) {
  return (
    <div className="border-b border-[#2A2A38] pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <p className="text-xs uppercase tracking-wider text-[#5A5A72]">{label}</p>
      <p className="text-white text-sm mt-0.5">{value || '—'}</p>
    </div>
  )
}
