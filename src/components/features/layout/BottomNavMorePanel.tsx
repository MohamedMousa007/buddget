'use client'

import Link from 'next/link'
import type { BuddgetNavIcon } from '@/lib/navigation/bottomNavConfig'
import { cn } from '@/lib/utils'
import { localeInlineLabelClass, useLocale, useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'

export function BottomNavMorePanel({
  pathname,
  items,
  onNavigate,
}: {
  pathname: string
  items: { href: string; label: string; icon: BuddgetNavIcon }[]
  onNavigate: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  return (
    <div
      className="fixed start-3 end-3 z-[56] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-xl shadow-black/40 p-2 pb-3"
      style={{ bottom: 'max(1rem, calc(4rem + env(safe-area-inset-bottom, 0px)))' }}
    >
      <p
        className={cn(
          'px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]',
          locale === 'ar' && 'text-end',
        )}
      >
        {t.common.goTo}
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
                <span className={localeInlineLabelClass(locale)}>
                  {t.nav[m.label as keyof Dictionary['nav']]}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
