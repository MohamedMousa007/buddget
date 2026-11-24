'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/** A closed-by-default section: the native <details> element, so it is keyboard and screen-reader friendly with no state. */
export function InsightsFold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] open:pb-3">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden className="size-4 text-[var(--color-brand-text-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-3 pt-1">{children}</div>
    </details>
  )
}
