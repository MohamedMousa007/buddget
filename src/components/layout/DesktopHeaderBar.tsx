'use client'

import Link from 'next/link'
import { PAGE_HEADER_SURFACE_BASE } from '@/components/layout/PageHeader'
import { AuthNavButtons } from '@/components/layout/AuthNavButtons'

/** Fixed top bar: logo (mobile) + profile, settings, notifications (all breakpoints). */
export function DesktopHeaderBar() {
  return (
    <header
      className={`flex flex-nowrap fixed top-0 left-0 right-0 lg:left-[200px] z-40 h-[52px] items-center justify-between gap-3 px-4 lg:px-6 border-b border-[var(--color-brand-border)] ${PAGE_HEADER_SURFACE_BASE}`}
    >
      <Link
        href="/"
        className="lg:hidden shrink-0 text-xl font-bold font-heading tracking-tight text-white"
      >
        Bud<span className="text-[var(--color-brand-red)]">d</span>get
      </Link>
      <div className="hidden lg:block flex-1 min-w-0" aria-hidden />
      <AuthNavButtons className="shrink-0" />
    </header>
  )
}
