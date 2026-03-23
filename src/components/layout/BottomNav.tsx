'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Receipt, Landmark, Plus, Menu, Wallet, PiggyBank, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

type BottomItem =
  | { kind: 'link'; href: string; label: string; icon: LucideIcon }
  | { kind: 'fab'; icon: typeof Plus }
  | { kind: 'more'; label: string; icon: typeof Menu }

const ITEMS: BottomItem[] = [
  { kind: 'link', href: '/', label: 'Home', icon: LayoutDashboard },
  { kind: 'link', href: '/expenses', label: 'Expenses', icon: Receipt },
  { kind: 'fab', icon: Plus },
  { kind: 'link', href: '/debts', label: 'Debts', icon: Landmark },
  { kind: 'more', label: 'More', icon: Menu },
]

/** Extra routes in the “More” sheet — keep in sync when adding top-level pages. */
const MORE_MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/income', label: 'Income', icon: Wallet },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
]

const MORE_HREFS = new Set(MORE_MENU.map((m) => m.href))

export function BottomNav() {
  const pathname = usePathname()
  const { setActiveModal } = useSettingsStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = moreWrapRef.current
      if (el && !el.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [moreOpen])

  const moreActive = MORE_HREFS.has(pathname)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-brand-card)]/95 backdrop-blur-xl border-t border-[var(--color-brand-border)] safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {ITEMS.map((item) => {
          if (item.kind === 'fab') {
            return (
              <motion.button
                key="fab"
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  setActiveModal('quickAdd')
                }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="flex items-center justify-center w-12 h-12 -mt-6 rounded-full bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white shadow-lg shadow-red-900/30 transition-colors duration-200"
                aria-label="Quick add"
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
                    onClick={() => setMoreOpen(false)}
                  />
                ) : null}
                {moreOpen ? (
                  <div
                    className="fixed left-3 right-3 z-[56] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-xl shadow-black/40 p-2 pb-3"
                    style={{ bottom: 'max(1rem, calc(4rem + env(safe-area-inset-bottom, 0px)))' }}
                  >
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
                      Navigate
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {MORE_MENU.map((m) => {
                        const active = pathname === m.href
                        return (
                          <li key={m.href}>
                            <Link
                              href={m.href}
                              onClick={() => setMoreOpen(false)}
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
                  <span className="text-[11px] font-medium">{item.label}</span>
                </button>
              </div>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                'flex flex-col items-center gap-1 py-1 px-3 transition-colors duration-200',
                isActive ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-muted)]'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
