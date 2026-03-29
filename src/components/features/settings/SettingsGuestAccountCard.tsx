'use client'

import { Shield } from 'lucide-react'

export interface SettingsGuestAccountCardProps {
  onOpenAuth: () => void
}

/**
 * CTA for guests to sign up / log in when Supabase is configured.
 */
export function SettingsGuestAccountCard({ onOpenAuth }: SettingsGuestAccountCardProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-3 border border-[var(--color-brand-border)]/80">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Welcome to Buddget</h2>
      </div>
      <p className="text-sm text-[var(--color-brand-text-muted)]">
        Right now your data lives on this device. Create an account to keep your budget safe, synced, and accessible
        from anywhere.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
        >
          Get started
        </button>
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-[var(--color-brand-border)] text-sm text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          I have an account
        </button>
      </div>
    </section>
  )
}
