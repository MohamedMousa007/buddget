'use client'

import { useEffect } from 'react'
import { Lock, LogOut, Trash2 } from 'lucide-react'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsSecuritySection } from '@/components/features/settings/SettingsSecuritySection'
import { BiometricLoginToggle } from '@/components/features/settings/BiometricLoginToggle'
import { AppLockToggle } from '@/components/features/settings/AppLockToggle'
import { SettingsPaymentMethodsSection } from '@/components/features/settings/SettingsPaymentMethodsSection'
import { DeleteAccountDialog } from '@/components/features/profile/DeleteAccountDialog'
import { AccountDeletedScreen } from '@/components/features/profile/AccountDeletedScreen'
import { ProfileFieldRow } from '@/components/profile/ProfileFieldRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useProfilePage } from '@/hooks/useProfilePage'
import { navigate } from '@/lib/navigation/navigate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export default function SettingsAccountPage() {
  const p = useProfilePage()
  const { t } = p
  const store = useFinanceStore()
  const { setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()

  useEffect(() => {
    if (p.user === null) navigate('/settings', { replace: true })
  }, [p.user])

  if (!p.user) return null

  return (
    <SettingsSubPageShell title={t.settings.hub.account} backHref="/settings/you">
      {/* Account info */}
      <Card padding="none" className="p-6">
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
          {t.profile.accountTitle}
        </h2>
        <div className="space-y-3">
          <ProfileFieldRow label={t.profile.accountEmail} value={p.user.email || ''} />
          <ProfileFieldRow
            label={t.profile.accountMemberSince}
            value={
              store.profile.createdAt
                ? new Date(store.profile.createdAt).toLocaleDateString(
                    p.locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US',
                    { month: 'long', year: 'numeric' }
                  )
                : ''
            }
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[var(--color-brand-border)]">
          {/* Neutral secondary action. */}
          <Button variant="outline" size="touch" onClick={p.handlePasswordReset}>
            <Lock className="w-4 h-4" />
            {t.profile.changePassword}
          </Button>
          {/* Destructive, but reversible — outlined red, not a solid fill. */}
          <Button
            variant="outline"
            size="touch"
            onClick={p.handleSignOut}
            className="border-[var(--color-brand-red)]/30 bg-transparent text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/10 hover:text-[var(--color-brand-red)] dark:border-[var(--color-brand-red)]/30 dark:bg-transparent dark:hover:bg-[var(--color-brand-red)]/10"
          >
            <LogOut className="w-4 h-4" />
            {t.common.signOut}
          </Button>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--color-brand-border)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-red)] mb-1">
            {t.profile.deleteAccountTitle}
          </h3>
          <p className="text-xs text-[var(--color-brand-text-muted)] leading-relaxed mb-3">
            {t.profile.deleteAccountBody}
          </p>
          {/* Irreversible — the solid red fill. */}
          <Button
            variant="destructive-solid"
            size="touch"
            onClick={p.openDeleteDialog}
            className="font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            {t.profile.deleteAccountButton}
          </Button>
        </div>
      </Card>

      {/* Security */}
      <SettingsSecuritySection store={store} />
      <BiometricLoginToggle userEmail={p.user.email} />
      <AppLockToggle userEmail={p.user.email} />

      {/* Payment methods */}
      <SettingsPaymentMethodsSection
        store={store}
        onOpen={() =>
          requireAuth(
            () => setActiveModal('paymentMethods'),
            t.modals.fabRequireAuth
          )
        }
      />

      <DeleteAccountDialog
        open={p.deleteOpen}
        onClose={p.closeDeleteDialog}
        onConfirm={p.confirmDelete}
        inProgress={p.deleting}
        error={p.deleteError}
      />

      {p.deleteSuccess && <AccountDeletedScreen />}
    </SettingsSubPageShell>
  )
}
