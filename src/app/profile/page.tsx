'use client'

import { User, Pencil, LogOut, Lock } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { AvatarPickerModal } from '@/components/profile/AvatarPickerModal'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { ProfileFieldRow } from '@/components/profile/ProfileFieldRow'
import { getProfileCountryDisplayLabel } from '@/lib/profile/countryOptions'
import { SettingsPaymentMethodsSection } from '@/components/features/settings/SettingsPaymentMethodsSection'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useProfilePage } from '@/hooks/useProfilePage'

export default function ProfilePage() {
  const p = useProfilePage()
  const { t } = p
  const { setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.profile.pageTitle}
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
        <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-32 shrink-0 flex flex-col items-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-[#2A2A38] bg-[var(--color-brand-elevated)] flex items-center justify-center">
                  {p.avatarSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarSrc} alt="" className="w-full h-full object-cover" width={96} height={96} />
                  ) : (
                    <User className="w-10 h-10 text-[var(--color-brand-text-secondary)]" />
                  )}
                </div>
                {p.editMode && (
                  <button
                    type="button"
                    onClick={() => p.setAvatarModalOpen(true)}
                    className="absolute bottom-0 end-0 w-7 h-7 rounded-full bg-[#E50914] flex items-center justify-center cursor-pointer hover:bg-[var(--color-brand-red-hover)] transition-colors"
                    aria-label={t.profile.changeAvatar}
                  >
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
              {!p.editMode && (
                <button
                  type="button"
                  onClick={p.enterEditMode}
                  className="text-sm text-[#A0A0B8] hover:text-white border border-[#2A2A38] rounded-lg px-3 py-1.5 mt-3 w-full text-center transition-colors"
                >
                  {t.profile.editProfile}
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {p.editMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">{t.profile.labelName}</label>
                    <input
                      value={p.form.name}
                      onChange={(e) => p.updateField('name', e.target.value)}
                      className={p.inputClass}
                      placeholder={t.profile.placeholderName}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">
                      {p.user ? t.profile.labelEmailAccount : t.profile.labelEmail}
                    </label>
                    <input
                      value={p.form.email}
                      onChange={(e) => {
                        if (!p.user) p.updateField('email', e.target.value)
                      }}
                      readOnly={!!p.user}
                      className={`${p.inputClass} ${p.user ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">{t.profile.labelPhone}</label>
                    <input
                      value={p.form.phone}
                      onChange={(e) => p.updateField('phone', e.target.value)}
                      className={p.inputClass}
                      placeholder={t.profile.placeholderPhone}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">{t.profile.labelCountry}</label>
                    <CountrySelect
                      value={p.form.country}
                      onChange={(nameEn) => p.updateField('country', nameEn)}
                      locale={p.locale}
                      placeholder={t.profile.placeholderCountrySelect}
                      className={p.inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">{t.profile.labelCity}</label>
                    <input
                      value={p.form.city}
                      onChange={(e) => p.updateField('city', e.target.value)}
                      className={p.inputClass}
                      placeholder={t.profile.placeholderCity}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <ProfileFieldRow label={t.profile.labelName} value={p.displayName} />
                  <ProfileFieldRow label={t.profile.labelEmail} value={p.displayEmail} />
                  <ProfileFieldRow label={t.profile.labelPhone} value={p.store.profile.phone || ''} />
                  <ProfileFieldRow
                    label={t.profile.labelCountry}
                    value={getProfileCountryDisplayLabel(p.store.profile.country, p.locale)}
                  />
                  <ProfileFieldRow label={t.profile.labelCity} value={p.store.profile.city || ''} />
                </>
              )}
            </div>
          </div>

          {p.editMode && (
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2A2A38]">
              <button
                type="button"
                onClick={p.discard}
                className="px-4 py-2 rounded-xl border border-[#2A2A38] text-sm text-[#A0A0B8] hover:text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
              >
                {t.profile.discard}
              </button>
              <button
                type="button"
                onClick={p.save}
                className="px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              >
                {t.profile.saveChanges}
              </button>
            </div>
          )}
        </div>

        <SettingsPaymentMethodsSection
          store={p.store}
          onAddClick={() =>
            requireAuth(
              () => setActiveModal('addPaymentMethod'),
              t.modals.fabRequireAuth
            )
          }
        />

        {p.user && (
          <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
              {t.profile.accountTitle}
            </h2>
            <div className="space-y-3">
              <ProfileFieldRow label={t.profile.accountEmail} value={p.user.email || ''} />
              <ProfileFieldRow
                label={t.profile.accountMemberSince}
                value={
                  p.store.profile.createdAt
                    ? new Date(p.store.profile.createdAt).toLocaleDateString(
                        p.locale === 'ar' ? 'ar-EG' : 'en-US',
                        { month: 'long', year: 'numeric' }
                      )
                    : ''
                }
              />
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#2A2A38]">
              <button
                type="button"
                onClick={p.handlePasswordReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2A2A38] text-sm text-[#A0A0B8] hover:text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
              >
                <Lock className="w-4 h-4" />
                {p.resetSent ? t.profile.resetLinkSent : t.profile.changePassword}
              </button>
              <button
                type="button"
                onClick={p.handleSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E50914]/30 text-sm text-[#E50914] hover:bg-[#E50914]/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t.common.signOut}
              </button>
            </div>
          </div>
        )}
      </div>

      <AvatarPickerModal
        open={p.avatarModalOpen}
        onClose={() => p.setAvatarModalOpen(false)}
        store={p.store}
      />
    </div>
  )
}
