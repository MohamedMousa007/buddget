'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PiggyBank,
  Landmark,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { Currency } from '@/lib/store/types'
const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/income', label: 'Income', icon: Wallet },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/debts', label: 'Debts', icon: Landmark },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  const { settings, updateSettings } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings }))
  )

  return (
    <aside className="hidden lg:flex flex-col w-[200px] h-screen bg-[var(--color-brand-card)] border-r border-[var(--color-brand-border)] fixed left-0 top-0 z-40">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold font-heading tracking-tight">
            Bud<span className="text-[var(--color-brand-red)]">d</span>get
          </span>
        </Link>
      </div>

      <div className="px-3 mb-4">
        <select
          value={settings.baseCurrency}
          onChange={(e) => updateSettings({ baseCurrency: e.target.value as Currency })}
          className="w-full h-8 px-2.5 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-xs font-medium cursor-pointer"
        >
          {FIAT_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[var(--color-brand-red)] text-white'
                  : 'text-[var(--color-brand-text-secondary)] hover:text-white hover:bg-[var(--color-brand-elevated)]'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

    </aside>
  )
}
