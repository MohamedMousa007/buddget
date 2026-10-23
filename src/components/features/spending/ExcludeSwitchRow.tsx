'use client'

import { Switch } from '@/components/ui/switch'

interface ExcludeSwitchRowProps {
  title: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

/** A titled switch with one line of help, built from the app's touch-size Switch. */
export function ExcludeSwitchRow({ title, hint, checked, onChange, disabled }: ExcludeSwitchRowProps) {
  return (
    <label className={`flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] px-4 py-2 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{title}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-[var(--color-brand-text-muted)]">{hint}</span> : null}
      </span>
      <Switch size="touch" aria-label={title} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  )
}
