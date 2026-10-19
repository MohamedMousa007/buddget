'use client'

import type { ReactNode } from 'react'
import { BuddgetMark } from '@/components/brand'
import { Card } from '@/components/ui/card'

/** Centered card used by every pre-portal screen (no access, setup, unlock). */
export function AuthFrame({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10 safe-area-bottom">
      <div className={wide ? 'w-full max-w-lg' : 'w-full max-w-sm'}>
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[var(--color-brand-primary-soft)]">
            <BuddgetMark size={30} />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary-ink)]">Buddget Admin</p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-[var(--color-brand-text-primary)]">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-[var(--color-brand-text-secondary)]">{subtitle}</p> : null}
        </div>
        <Card elevation="md" padding="lg">{children}</Card>
      </div>
    </div>
  )
}
