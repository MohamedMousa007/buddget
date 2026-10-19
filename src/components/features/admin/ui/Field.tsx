'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-[var(--color-brand-text-muted)]">{hint}</span> : null}
    </label>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-brand-border)] px-5 py-3">{children}</div>
}
