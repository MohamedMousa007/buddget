'use client'

import type { RefObject } from 'react'
import { CARTOON_AVATAR_PRESETS, cartoonAvatarUrlForPreset } from '@/lib/onboarding/cartoonAvatars'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { FinanceStore } from '@/lib/store/types'
import { Button } from '@/components/ui/button'

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
      <p className="text-xs text-[var(--color-brand-text-muted)]">
        {t.profile.photoDesc}
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onAvatarFile}
      />
      <Button
        onClick={() => fileRef.current?.click()}
        variant="outline"
        size="cta-block"
        className="sm:w-auto"
      >
        {t.profile.avatarUploadPhoto}
      </Button>
      {store.profile.avatar?.startsWith('data:') ? (
        <Button
          onClick={() => store.updateProfile({ avatar: undefined })}
          variant="link"
          size="xs"
          className="no-underline hover:underline block text-[var(--color-brand-text-muted)]"
        >
          {t.profile.removePhoto}
        </Button>
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
                  ? 'border-[var(--color-brand-primary)] ring-2 ring-[var(--color-brand-primary)]/30'
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
