'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type { MoreMenuItem } from '@/lib/navigation/bottomNavConfig'
import { cn } from '@/lib/utils'
import { localeInlineLabelClass, useLocale, useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'

export function BottomNavMorePanel({
  pathname,
  items,
  onNavigate,
}: {
  pathname: string
  items: MoreMenuItem[]
  onNavigate: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  return (
    <motion.div
      initial={{ y: '110%' }}
      animate={{ y: 0 }}
      exit={{ y: '110%' }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="fixed start-0 end-0 bottom-0 z-[56] rounded-t-3xl border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 pt-2.5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.7)]"
      style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto mt-0.5 mb-3 h-1.5 w-11 rounded-sm bg-[var(--color-brand-border)]" />
      <p
        className={cn(
          'px-1 pb-2 text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-brand-text-muted)]',
          locale === 'ar' && 'text-end',
        )}
      >
        {t.common.goTo}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((m) => {
          const active = pathname === m.href
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3.5 rounded-2xl px-2.5 py-2.5 text-left transition-colors',
                  active
                    ? 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-red)]'
                    : 'text-[var(--color-brand-text-primary)]',
                )}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: m.bg, color: m.fg }}
                >
                  <m.icon className="h-5 w-5" />
                </span>
                <span className={cn('flex-1 text-sm font-semibold', localeInlineLabelClass(locale))}>
                  {t.nav[m.label as keyof Dictionary['nav']]}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" />
              </Link>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}
