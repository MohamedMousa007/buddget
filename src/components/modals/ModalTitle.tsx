'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useModalTitleId } from '@/components/modals/ModalShell'

/** A sheet's 18/700 heading, wired to ModalShell's `aria-labelledby`. Render inside the shell. */
export function ModalTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 id={useModalTitleId()} className={cn('text-lg font-bold text-[var(--color-brand-text-primary)]', className)}>
      {children}
    </h2>
  )
}

/**
 * A sheet's own heading element, wired to ModalShell's `aria-labelledby`. The id comes from context, so it must be
 * rendered BELOW the shell: calling `useModalTitleId()` in the component that renders `<ModalShell>` reads nothing and leaves the dialog unnamed.
 */
export function ModalHeading({ as: Tag = 'h2', className, children }: { as?: 'h2' | 'span' | 'div'; className?: string; children: ReactNode }) {
  return (
    <Tag id={useModalTitleId()} className={className}>
      {children}
    </Tag>
  )
}
