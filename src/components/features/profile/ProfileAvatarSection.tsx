'use client'

import type { RefObject } from 'react'
import { CARTOON_AVATAR_PRESETS, cartoonAvatarUrlForPreset } from '@/lib/onboarding/cartoonAvatars'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { FinanceStore } from '@/lib/store/types'

export interface ProfileAvatarSectionProps {
  fileRef: RefObject<HTMLInputElement | null>
  store: FinanceStore
  activePreset: string | undefined
  onAvatarFile: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * Upload + cartoon preset grid for profile photo.
 */
export function ProfileAvatarSection({ fileRef, store, activePreset, onAvatarFile }: ProfileAvatarSectionProps) {
  const t = useT()

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">{t.profile.photoTitle}</h2>
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">
        {t.profile.photoDesc}
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onAvatarFile}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
      >
        {t.profile.avatarUploadPhoto}
      </button>
      {store.profile.avatar?.startsWith('data:') ? (
        <button
          type="button"
          onClick={() => store.updateProfile({ avatar: undefined })}
          className="block text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
        >
          {t.profile.removePhoto}
        </button>
      ) : null}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-2">
        {CARTOON_AVATAR_PRESETS.map((p) => {
          const src = cartoonAvatarUrlForPreset(p.id)
          const selected = activePreset === p.id
          return (
            <button
              key={p.id}
              type="button"
              title={p.label}
              onClick={() =>
                store.updateProfile({
                  avatarPresetId: p.id,
                  avatar: undefined,
                })
              }
              className={cn(
                'aspect-square rounded-xl overflow-hidden border-2 transition-all bg-[var(--color-brand-elevated)]',
                selected
                  ? 'border-[var(--color-brand-red)] ring-2 ring-[var(--color-brand-red)]/30'
                  : 'border-transparent opacity-90 hover:opacity-100'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" width={80} height={80} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
