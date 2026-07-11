'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { ArrowLeft, Shield } from 'lucide-react'
import { PAGE_HEADER_SURFACE_CLASS } from '@/components/layout/PageHeader'

export interface AdminDashboardHeaderProps {
  onLock: () => void
}

/**
 * Top bar for the unlocked admin area (back + title + lock).
 */
export function AdminDashboardHeader({ onLock }: AdminDashboardHeaderProps) {
  return (
    <header className={PAGE_HEADER_SURFACE_CLASS}>
      <div className="flex items-center justify-between px-4 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">Admin Panel</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={onLock}
          className="text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)]"
        >
          Lock
        </button>
      </div>
    </header>
  )
}
