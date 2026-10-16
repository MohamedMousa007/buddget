'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { useNavPath } from '@/lib/navigation/navStore'
import {
  SlidersHorizontal,
  Landmark,
  BarChart3,
  HandCoins,
  CalendarClock,
  Target,
  Repeat,
  Bell,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { localeInlineLabelClass, useLocale, useT } from '@/lib/i18n'
import { BuddgetWordmark } from '@/components/brand'
import { FlowTabIcon } from '@/components/icons/FlowTabIcon'
import { activeNavHref } from '@/lib/navigation/isTabActive'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon | ComponentType<{ className?: string }>
}

export function Sidebar() {
  const pathname = useNavPath()
  const t = useT()
  const { locale } = useLocale()

  const PRIMARY: NavItem[] = [
    { href: '/flow', label: t.nav.flow, icon: FlowTabIcon },
    { href: '/budget-setup', label: t.nav.budgetSetup, icon: SlidersHorizontal },
    { href: '/wealth', label: t.nav.wealth, icon: HandCoins },
    { href: '/debts', label: t.nav.debts, icon: Landmark },
    { href: '/reports', label: t.nav.reports, icon: BarChart3 },
  ]
  const MORE: NavItem[] = [
    { href: '/paydays', label: t.nav.paydays, icon: CalendarClock },
    { href: '/goals', label: t.nav.goals, icon: Target },
    { href: '/subscriptions', label: t.nav.subscriptions, icon: Repeat },
    { href: '/notifications', label: t.notifications.title, icon: Bell },
    { href: '/settings', label: t.nav.settings, icon: Settings },
  ]
  const activeHref = activeNavHref(pathname, [...PRIMARY, ...MORE].map((i) => i.href))
  const { settings, updateSettings } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings }))
  )

  const renderItem = (item: NavItem) => {
    const isActive = item.href === activeHref
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200',
          locale === 'ar' && 'flex-row-reverse',
          isActive
            ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
            : 'text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]'
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{item.label}</span>
      </Link>
    )
  }

  return (
    <aside className="hidden lg:flex flex-col w-[var(--sidebar-w)] bg-[var(--color-brand-card)] border-e border-[var(--color-brand-border)] fixed start-0 inset-y-0 z-40 overflow-hidden">
      <div className="p-4">
        <Link href="/flow" className="flex items-center gap-2">
          <BuddgetWordmark height={24} />
        </Link>
      </div>

      <div className="px-3 mb-3">
        <FiatCurrencyField
          value={settings.baseCurrency}
          onChange={(v) => updateSettings({ baseCurrency: v })}
          className="w-full h-9 px-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
        />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1">
        {PRIMARY.map(renderItem)}
        <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)]">
          {t.nav.more}
        </p>
        {MORE.map(renderItem)}
      </nav>
    </aside>
  )
}
