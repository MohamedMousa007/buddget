'use client'

import { User, Pencil } from 'lucide-react'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { ProfileFieldRow } from '@/components/profile/ProfileFieldRow'
import { getProfileCountryDisplayLabel } from '@/lib/profile/countryOptions'
import { AvatarPickerModal } from '@/components/profile/AvatarPickerModal'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useProfilePage } from '@/hooks/useProfilePage'

export default function SettingsProfilePage() {
  const p = useProfilePage()
  const { t } = p

  return (
    <SettingsSubPageShell title={t.settings.hub.profile}>
      <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-32 shrink-0 flex flex-col items-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] flex items-center justify-center">
                {p.avatarSrc
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.avatarSrc} alt="" className="w-full h-full object-cover" width={96} height={96} />
                  : <User className="w-10 h-10 text-[var(--color-brand-text-secondary)]" />}
              </div>
              {p.editMode && (
                <button
                  type="button"
                  onClick={() => p.setAvatarModalOpen(true)}
                  className="absolute bottom-0 end-0 w-7 h-7 rounded-full bg-[var(--color-brand-red)] flex items-center justify-center hover:bg-[var(--color-brand-red-hover)] transition-colors"
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
                className="text-sm text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] border border-[var(--color-brand-border)] rounded-lg px-3 py-1.5 mt-3 w-full text-center transition-colors"
              >
                {t.profile.editProfile}
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {p.editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">{t.profile.labelName}</label>
                  <input value={p.form.name} onChange={(e) => p.updateField('name', e.target.value)} className={p.inputClass} placeholder={t.profile.placeholderName} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">
                    {p.user ? t.profile.labelEmailAccount : t.profile.labelEmail}
                  </label>
                  <input
                    value={p.form.email}
                    onChange={(e) => { if (!p.user) p.updateField('email', e.target.value) }}
                    readOnly={!!p.user}
                    className={`${p.inputClass} ${p.user ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">{t.profile.labelPhone}</label>
                  <input value={p.form.phone} onChange={(e) => p.updateField('phone', e.target.value)} className={p.inputClass} placeholder={t.profile.placeholderPhone} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">{t.profile.labelCountry}</label>
                  <CountrySelect value={p.form.country} onChange={(v) => p.updateField('country', v)} locale={p.locale} placeholder={t.profile.placeholderCountrySelect} className={p.inputClass} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">{t.profile.labelCity}</label>
                  <input value={p.form.city} onChange={(e) => p.updateField('city', e.target.value)} className={p.inputClass} placeholder={t.profile.placeholderCity} />
                </div>
              </div>
            ) : (
              <>
                <ProfileFieldRow label={t.profile.labelName} value={p.displayName} />
                <ProfileFieldRow label={t.profile.labelEmail} value={p.displayEmail} />
                <ProfileFieldRow label={t.profile.labelPhone} value={p.store.profile.phone || ''} />
                <ProfileFieldRow label={t.profile.labelCountry} value={getProfileCountryDisplayLabel(p.store.profile.country, p.locale)} emptyHint={t.profile.readOnlyFieldEmptyHint} />
                <ProfileFieldRow label={t.profile.labelCity} value={p.store.profile.city || ''} emptyHint={t.profile.readOnlyFieldEmptyHint} />
              </>
            )}
          </div>
        </div>

        {p.editMode && (
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-brand-border)]">
            <button
              type="button"
              onClick={p.discard}
              className="px-4 py-2 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              {t.profile.discard}
            </button>
            <button
              type="button"
              onClick={p.save}
              className="px-4 py-2 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
            >
              {t.profile.saveChanges}
            </button>
          </div>
        )}
      </div>

      <AvatarPickerModal open={p.avatarModalOpen} onClose={() => p.setAvatarModalOpen(false)} store={p.store} />
    </SettingsSubPageShell>
  )
}
