'use client'

import { Server } from 'lucide-react'
import type { AdminConfig } from '@/types/admin'

export interface AdminServerSectionProps {
  config: AdminConfig | null
}

/**
 * Environment label and public app URL from admin config.
 */
export function AdminServerSection({ config }: AdminServerSectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Server className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Server</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-[var(--color-brand-text-secondary)]">Environment</span>
          <span className="text-sm font-mono-numbers text-white">{config?.environment || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-[var(--color-brand-border)]">
          <span className="text-sm text-[var(--color-brand-text-secondary)]">App URL</span>
          <span className="text-sm font-mono-numbers text-white">{config?.appUrl || '—'}</span>
        </div>
      </div>
    </section>
  )
}
