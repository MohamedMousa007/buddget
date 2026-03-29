'use client'

import { LogOut, Shield } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { User } from '@supabase/supabase-js'

export interface SettingsSignedInAccountCardProps {
  user: User
  onSignOut: () => void
}

/**
 * Signed-in user email and sign-out control.
 */
export function SettingsSignedInAccountCard({ user, onSignOut }: SettingsSignedInAccountCardProps) {
  const t = useT()

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">{t.settings.accountTitle}</h2>
      </div>
      <p className="text-xs text-[var(--color-brand-text-muted)]">
        {t.settings.accountSignedIn(user.email ?? '')}
      </p>
      <button
        type="button"
        onClick={() => void onSignOut()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-brand-border)] text-sm text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
      >
        <LogOut className="w-4 h-4" />
        {t.settings.accountSignOut}
      </button>
    </section>
  )
}
