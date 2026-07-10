'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, LogOut, Trash2 } from 'lucide-react'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsSecuritySection } from '@/components/features/settings/SettingsSecuritySection'
import { BiometricLoginToggle } from '@/components/features/settings/BiometricLoginToggle'
import { AppLockToggle } from '@/components/features/settings/AppLockToggle'
import { SettingsPaymentMethodsSection } from '@/components/features/settings/SettingsPaymentMethodsSection'
import { DeleteAccountDialog } from '@/components/features/profile/DeleteAccountDialog'
import { AccountDeletedScreen } from '@/components/features/profile/AccountDeletedScreen'
import { ProfileFieldRow } from '@/components/profile/ProfileFieldRow'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useProfilePage } from '@/hooks/useProfilePage'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export default function SettingsAccountPage() {
  const p = useProfilePage()
  const { t } = p
  const store = useFinanceStore()
  const { setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const router = useRouter()

  useEffect(() => {
    if (p.user === null) router.replace('/settings')
  }, [p.user, router])

  if (!p.user) return null

  return (
    <SettingsSubPageShell title={t.settings.hub.account}>
      {/* Account info */}
      <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-6">
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
          <button
            type="button"
            onClick={p.handlePasswordReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            <Lock className="w-4 h-4" />
            {t.profile.changePassword}
          </button>
          <button
            type="button"
            onClick={p.handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-brand-red)]/30 text-sm text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t.common.signOut}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--color-brand-border)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-red)] mb-1">
            {t.profile.deleteAccountTitle}
          </h3>
          <p className="text-xs text-[var(--color-brand-text-muted)] leading-relaxed mb-3">
            {t.profile.deleteAccountBody}
          </p>
          <button
            type="button"
            onClick={p.openDeleteDialog}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t.profile.deleteAccountButton}
          </button>
        </div>
      </div>

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
