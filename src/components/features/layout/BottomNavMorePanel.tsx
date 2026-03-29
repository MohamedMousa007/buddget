'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomNavMorePanel({
  pathname,
  items,
  onNavigate,
}: {
  pathname: string
  items: { href: string; label: string; icon: LucideIcon }[]
  onNavigate: () => void
}) {
  return (
    <div
      className="fixed left-3 right-3 z-[56] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-xl shadow-black/40 p-2 pb-3"
      style={{ bottom: 'max(1rem, calc(4rem + env(safe-area-inset-bottom, 0px)))' }}
    >
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
        Go to
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((m) => {
          const active = pathname === m.href
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-red)]'
                    : 'text-white hover:bg-[var(--color-brand-elevated)]'
                )}
              >
                <m.icon className="h-5 w-5 shrink-0 opacity-90" />
                {m.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
