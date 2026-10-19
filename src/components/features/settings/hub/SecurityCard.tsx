'use client'

import { useState } from 'react'
import { ChevronDown, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { AppLockToggle } from '@/components/features/settings/AppLockToggle'
import { BiometricLoginToggle } from '@/components/features/settings/BiometricLoginToggle'
import { SettingsChip } from '@/components/features/settings/SettingsRow'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { Card } from '@/components/ui/card'
import { useProfilePage } from '@/hooks/useProfilePage'
import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { cn } from '@/lib/utils'

type Profile = ReturnType<typeof useProfilePage>

const rowButton =
  'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-start transition-colors hover:bg-[var(--color-brand-elevated)]'

/** Sign-in and security as one collapsible card: password, two-step, biometrics, app lock and sign out inside. */
export function SecurityCard({ p }: { p: Profile }) {
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const t = p.t
  const tone = GROUP_TONE.security
  const focusId = useSettingsStore((s) => s.settingsFocusId)
  const [open, setOpen] = useState(false)
  const expanded = open || (focusId !== null && ['password', 'twoFactor', 'biometric', 'appLock'].includes(focusId))
  const user = p.user

  const memberSince = p.store.profile.createdAt
    ? new Date(p.store.profile.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <section>
      <p className="px-1 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{copy.groupName.security}</p>
      <Card padding="none" className="overflow-hidden">
        <button
          type="button"
          data-raw-button-ok="accordion header row"
          aria-expanded={expanded}
          onClick={() => setOpen((v) => !v)}
          className={rowButton}
        >
          <SettingsChip icon={ShieldCheck} tone={tone} />
          <span className={cn('min-w-0 flex-1', locale === 'ar' && 'text-end')}>
            <span className="block text-[15px] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{copy.security.title}</span>
            <span className="mt-0.5 block text-xs leading-snug text-[var(--color-brand-text-muted)]">{user ? copy.security.subtitle : copy.security.signIn}</span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-[var(--color-brand-text-muted)] transition-transform', expanded && 'rotate-180')} aria-hidden />
        </button>

        {expanded && user ? (
          <div className="divide-y divide-[var(--color-brand-border)] border-t border-[var(--color-brand-border)]">
            <div className="space-y-0.5 px-4 py-3 text-sm">
              <p className="text-[var(--color-brand-text-primary)]">{user.email}</p>
              {memberSince ? <p className="text-xs text-[var(--color-brand-text-muted)]">{copy.security.memberSince} {memberSince}</p> : null}
            </div>
            <button type="button" data-raw-button-ok="settings row" data-setting-id="password" onClick={p.handlePasswordReset} className={rowButton}>
              <SettingsChip icon={KeyRound} tone={tone} />
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.profile.changePassword}</span>
            </button>
            <SettingsSwitchRow
              id="twoFactor"
              label={t.settings.twoFaToggle}
              tone={tone}
              hint={t.settings.twoFaToggleHint}
              checked={p.store.settings.twoFactorEmailEnabled}
              onChange={(val) => p.store.updateSettings({ twoFactorEmailEnabled: val })}
            />
            <div data-setting-id="biometric"><BiometricLoginToggle userEmail={user.email} bare /></div>
            <div data-setting-id="appLock"><AppLockToggle userEmail={user.email} bare /></div>
            <button type="button" data-raw-button-ok="settings row" onClick={() => void p.handleSignOut()} className={cn(rowButton, 'text-[var(--color-brand-red)]')}>
              <SettingsChip icon={LogOut} destructive />
              <span className="min-w-0 flex-1 text-[15px] font-semibold">{t.common.signOut}</span>
            </button>
          </div>
        ) : null}
      </Card>
    </section>
  )
}
