'use client'

import { Switch } from '@/components/ui/switch'

interface ExcludeSwitchRowProps {
  title: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
}

/** A titled switch with one line of help, built from the app's touch-size Switch. */
export function ExcludeSwitchRow({ title, hint, checked, onChange }: ExcludeSwitchRowProps) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] px-4 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-[var(--color-brand-text-muted)]">{hint}</span>
      </span>
      <Switch size="touch" aria-label={title} checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
