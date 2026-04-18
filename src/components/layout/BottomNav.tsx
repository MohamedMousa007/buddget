'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'
import {
  BOTTOM_NAV_ITEMS,
  BOTTOM_NAV_MORE_MENU,
  BOTTOM_NAV_MORE_HREFS,
} from '@/lib/navigation/bottomNavConfig'
import { useBottomNavMoreSheet } from '@/hooks/useBottomNavMoreSheet'
import { BottomNavMorePanel } from '@/components/features/layout/BottomNavMorePanel'

export function BottomNav() {
  const pathname = usePathname()
  const t = useT()
  const { setActiveModal } = useSettingsStore()
  const { moreOpen, setMoreOpen, moreWrapRef } = useBottomNavMoreSheet()
  const moreActive = BOTTOM_NAV_MORE_HREFS.has(pathname)

  const closeMore = () => setMoreOpen(false)

  return (
    <nav className="lg:hidden fixed bottom-0 start-0 end-0 z-50 bg-[var(--color-brand-card)]/95 backdrop-blur-xl border-t border-[var(--color-brand-border)] safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          if (item.kind === 'fab') {
            return (
              <motion.button
                key="fab"
                type="button"
                data-tutorial-id="fab-root"
                onClick={() => {
                  closeMore()
                  setActiveModal('quickAdd')
                }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="flex items-center justify-center w-12 h-12 -mt-6 rounded-full bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white shadow-lg shadow-red-900/30 transition-colors duration-200"
                aria-label={t.nav.quickAdd}
              >
                <item.icon className="w-6 h-6" />
              </motion.button>
            )
          }

          if (item.kind === 'more') {
            return (
              <div key="more" ref={moreWrapRef} className="relative flex flex-col items-center">
                {moreOpen ? (
                  <div
                    className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px]"
                    aria-hidden
                    onClick={closeMore}
                  />
                ) : null}
                {moreOpen ? (
                  <BottomNavMorePanel pathname={pathname} items={BOTTOM_NAV_MORE_MENU} onNavigate={closeMore} />
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMoreOpen((v) => !v)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 py-1 px-3 transition-colors duration-200',
                    moreOpen || moreActive
                      ? 'text-[var(--color-brand-red)]'
                      : 'text-[var(--color-brand-text-muted)]'
                  )}
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium">{t.nav[item.label as keyof Dictionary['nav']]}</span>
                </button>
              </div>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tutorial-id={`nav-${item.label}`}
              onClick={closeMore}
              className={cn(
                'flex flex-col items-center gap-1 py-1 px-3 transition-colors duration-200',
                isActive ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-muted)]'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{t.nav[item.label as keyof Dictionary['nav']]}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
