'use client'

import { ShieldCheck } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/lib/i18n'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsSecuritySectionProps {
  store: FinanceStore
}

/**
 * "Security" settings card. Currently houses the email-based 2FA toggle.
 *
 * When on: a new browser must clear a 6-digit email OTP after the password before
 * it's let through. Known browsers (already in `trusted_devices`) skip the step.
 */
export function SettingsSecuritySection({ store }: SettingsSecuritySectionProps) {
  const t = useT()

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.settings.securityTitle}
        </h2>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Label className="text-sm text-[var(--color-brand-text-primary)]">{t.settings.twoFaToggle}</Label>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5 leading-relaxed">
            {t.settings.twoFaToggleHint}
          </p>
        </div>
        <Switch
          checked={store.settings.twoFactorEmailEnabled}
          onCheckedChange={(val) => store.updateSettings({ twoFactorEmailEnabled: val })}
        />
      </div>

      <p className="text-xs text-[var(--color-brand-text-muted)] border-t border-[var(--color-brand-border)] pt-3 leading-relaxed">
        {t.settings.twoFaFooter}
      </p>
    </section>
  )
}
