'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Receipt, Landmark, Plus, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

type BottomItem =
  | { kind: 'link'; href: string; label: string; icon: LucideIcon }
  | { kind: 'fab'; icon: typeof Plus }

const ITEMS: BottomItem[] = [
  { kind: 'link', href: '/', label: 'Home', icon: LayoutDashboard },
  { kind: 'link', href: '/expenses', label: 'Expenses', icon: Receipt },
  { kind: 'fab', icon: Plus },
  { kind: 'link', href: '/debts', label: 'Debts', icon: Landmark },
  { kind: 'link', href: '/reports', label: 'Reports', icon: BarChart3 },
]

export function BottomNav() {
  const pathname = usePathname()
  const { setActiveModal } = useSettingsStore()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-brand-card)]/95 backdrop-blur-xl border-t border-[var(--color-brand-border)] safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {ITEMS.map((item) => {
          if (item.kind === 'fab') {
            return (
              <motion.button
                key="fab"
                type="button"
                onClick={() => setActiveModal('quickAdd')}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="flex items-center justify-center w-12 h-12 -mt-6 rounded-full bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white shadow-lg shadow-red-900/30 transition-colors duration-200"
                aria-label="Quick add"
              >
                <item.icon className="w-6 h-6" />
              </motion.button>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-1 px-3 transition-colors duration-200',
                isActive
                  ? 'text-[var(--color-brand-red)]'
                  : 'text-[var(--color-brand-text-muted)]'
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
