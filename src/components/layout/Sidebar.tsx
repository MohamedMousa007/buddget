'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  SlidersHorizontal,
  Receipt,
  Wallet,
  Landmark,
  BarChart3,
  HandCoins,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { localeInlineLabelClass, useLocale, useT } from '@/lib/i18n'

export function Sidebar() {
  const pathname = usePathname()
  const t = useT()
  const { locale } = useLocale()

  const NAV_ITEMS = [
    { href: '/', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/budget-setup', label: t.nav.budgetSetup, icon: SlidersHorizontal },
    { href: '/expenses', label: t.nav.expenses, icon: Receipt },
    { href: '/income', label: t.nav.income, icon: Wallet },
    { href: '/savings', label: t.nav.savings, icon: HandCoins },
    { href: '/debts', label: t.nav.debts, icon: Landmark },
    { href: '/reports', label: t.nav.reports, icon: BarChart3 },
  ]
  const { settings, updateSettings } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings }))
  )
  return (
    <aside className="hidden lg:flex flex-col w-44 h-screen bg-[var(--color-brand-card)] border-e border-[var(--color-brand-border)] fixed start-0 top-0 z-40 overflow-hidden">
      <div className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold font-heading tracking-tight">
            Bud<span className="text-[var(--color-brand-red)]">d</span>get
          </span>
        </Link>
      </div>

      <div className="px-3 mb-3">
        <FiatCurrencyField
          value={settings.baseCurrency}
          onChange={(v) => updateSettings({ baseCurrency: v })}
          className="w-full h-9 px-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
        />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200',
                locale === 'ar' && 'flex-row-reverse',
                isActive
                  ? 'bg-[var(--color-brand-red)] text-white'
                  : 'text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className={localeInlineLabelClass(locale)}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

    </aside>
  )
}
