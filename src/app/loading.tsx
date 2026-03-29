'use client'

import { useT } from '@/lib/i18n'

export default function Loading() {
  const t = useT()
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4">
      <div className="h-10 w-10 rounded-full border-2 border-[var(--color-brand-border)] border-t-[var(--color-brand-red)] animate-spin" />
      <p className="text-sm text-[var(--color-brand-text-muted)]">{t.dashboard.loadingMessage}</p>
    </div>
  )
}
