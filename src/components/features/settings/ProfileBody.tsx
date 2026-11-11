'use client'

import { User, Camera, LogOut } from 'lucide-react'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { ProfileFieldRow } from '@/components/profile/ProfileFieldRow'
import { getProfileCountryDisplayLabel } from '@/lib/profile/countryOptions'
import { AvatarPickerModal } from '@/components/profile/AvatarPickerModal'
import type { useProfilePage } from '@/hooks/useProfilePage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'

/** Avatar plus the profile fields, editable in place. */
export function ProfileBody({ p }: { p: ReturnType<typeof useProfilePage> }) {
  const { t } = p
  return (
    <>
      <Card padding="none" className="p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-[var(--color-brand-primary)] bg-[var(--color-brand-elevated)] flex items-center justify-center">
                {p.avatarSrc
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.avatarSrc} alt="" className="w-full h-full object-cover" width={96} height={96} />
                  : <User className="w-10 h-10 text-[var(--color-brand-text-secondary)]" />}
              </div>
              <IconButton
                onClick={() => p.setAvatarModalOpen(true)}
                aria-label={t.profile.changeAvatar}
                variant="brand"
                size="sm"
                shape="round"
                className="absolute bottom-0 end-0"
              >
                <Camera className="w-3.5 h-3.5" />
              </IconButton>
            </div>
            {!p.editMode && (
              <Button variant="outline" size="touch" onClick={p.enterEditMode} className="mt-3 min-w-40">
                {t.profile.editProfile}
              </Button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {p.editMode ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="profile-edit-1" className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">{t.profile.labelName}</label>
                  <input id="profile-edit-1" value={p.form.name} onChange={(e) => p.updateField('name', e.target.value)} className={p.inputClass} placeholder={t.profile.placeholderName} />
                </div>
                <div>
                  <label htmlFor="profile-edit-2" className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">
                    {p.user ? t.profile.labelEmailAccount : t.profile.labelEmail}
                  </label>
                  <input id="profile-edit-2"
                    value={p.form.email}
                    onChange={(e) => { if (!p.user) p.updateField('email', e.target.value) }}
                    readOnly={!!p.user}
                    className={`${p.inputClass} ${p.user ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label htmlFor="profile-edit-3" className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">{t.profile.labelPhone}</label>
                  <input id="profile-edit-3" value={p.form.phone} onChange={(e) => p.updateField('phone', e.target.value)} className={p.inputClass} placeholder={t.profile.placeholderPhone} />
                </div>
                <div>
                  <label htmlFor="profile-edit-4" className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">{t.profile.labelCountry}</label>
                  <CountrySelect id="profile-edit-4" value={p.form.country} onChange={(v) => p.updateField('country', v)} locale={p.locale} placeholder={t.profile.placeholderCountrySelect} className={p.inputClass} />
                </div>
                <div>
                  <label htmlFor="profile-edit-5" className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)] block mb-1">{t.profile.labelCity}</label>
                  <input id="profile-edit-5" value={p.form.city} onChange={(e) => p.updateField('city', e.target.value)} className={p.inputClass} placeholder={t.profile.placeholderCity} />
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
            <Button variant="destructive" size="touch" onClick={p.discard}>
              {t.profile.discard}
            </Button>
            <Button size="touch" onClick={p.save} className="font-semibold">
              {t.profile.saveChanges}
            </Button>
          </div>
        )}
      </Card>

      {p.user ? (
        <Button
          variant="outline"
          size="cta-block"
          onClick={() => void p.handleSignOut()}
          className="mt-4 border-[var(--color-brand-red)]/30 text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-soft)] hover:text-[var(--color-brand-red)]"
        >
          <LogOut className="size-4" />{t.common.signOut}
        </Button>
      ) : null}

      <AvatarPickerModal open={p.avatarModalOpen} onClose={() => p.setAvatarModalOpen(false)} store={p.store} />
    </>
  )
}
