'use client'

import { useCallback, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { CARTOON_AVATAR_PRESETS, cartoonAvatarUrlForPreset } from '@/lib/onboarding/cartoonAvatars'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { isValidImageDataUrl } from '@/lib/profile/validImageDataUrl'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { useAlert } from '@/components/ui/dialog/DialogProvider'
import type { FinanceStore } from '@/lib/store/types'

type Tab = 'choose' | 'upload' | 'remove'

const AVATAR_FILE_MAX_BYTES = 5 * 1024 * 1024

interface AvatarPickerModalProps {
  open: boolean
  onClose: () => void
  store: FinanceStore
}

export function AvatarPickerModal({ open, onClose, store }: AvatarPickerModalProps) {
  const t = useT()
  const alert = useAlert()
  useScrollLock(open)
  const [tab, setTab] = useState<Tab>('choose')
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(store.profile.avatarPresetId)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const currentSrc = resolveProfileAvatarSrc(store.profile)

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > AVATAR_FILE_MAX_BYTES) {
      void alert({ title: t.profile.avatarTooLarge })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      if (!isValidImageDataUrl(reader.result)) {
        void alert({ title: t.profile.avatarInvalidFormat })
        return
      }
      setUploadPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }, [alert, t.profile.avatarTooLarge, t.profile.avatarInvalidFormat])

  const handleSave = () => {
    if (tab === 'choose' && selectedPreset) {
      store.updateProfile({ avatarPresetId: selectedPreset, avatar: undefined })
    } else if (tab === 'upload' && uploadPreview) {
      if (!isValidImageDataUrl(uploadPreview)) {
        void alert({ title: t.profile.avatarInvalidFormat })
        return
      }
      store.updateProfile({ avatar: uploadPreview, avatarPresetId: undefined })
    } else if (tab === 'remove') {
      store.updateProfile({ avatar: undefined, avatarPresetId: undefined })
    }
    onClose()
  }

  const handleClose = () => {
    setUploadPreview(null)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative z-10 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute end-3 top-3 p-2 rounded-lg text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-text-primary)]/5 hover:text-[var(--color-brand-text-primary)] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold text-[var(--color-brand-text-primary)] mb-4">{t.profile.avatarModalTitle}</h2>

        <div className="flex gap-2 mb-5">
          {(['choose', 'upload', 'remove'] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                tab === tabKey
                  ? 'bg-[var(--color-brand-red)] text-white'
                  : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]'
              )}
            >
              {tabKey === 'choose' ? t.profile.avatarTabPick : tabKey === 'upload' ? t.profile.avatarTabUpload : t.profile.avatarTabRemove}
            </button>
          ))}
        </div>

        {tab === 'choose' && (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {CARTOON_AVATAR_PRESETS.map((p) => {
              const src = cartoonAvatarUrlForPreset(p.id)
              const isSelected = selectedPreset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => setSelectedPreset(p.id)}
                  className={cn(
                    'w-16 h-16 rounded-full overflow-hidden ring-2 transition-all duration-150 cursor-pointer',
                    isSelected
                      ? 'ring-[var(--color-brand-red)] scale-105'
                      : 'ring-transparent hover:ring-[var(--color-brand-red)]'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={p.label} className="w-full h-full object-cover" width={64} height={64} />
                </button>
              )
            })}
          </div>
        )}

        {tab === 'upload' && (
          <div className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFile}
            />
            {uploadPreview ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 rounded-full overflow-hidden ring-2 ring-[var(--color-brand-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => { setUploadPreview(null); fileRef.current?.click() }}
                  className="text-sm text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] transition-colors"
                >
                  {t.profile.avatarChooseDifferent}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full py-10 rounded-xl border-2 border-dashed border-[var(--color-brand-border)] hover:border-[var(--color-brand-red)] text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] transition-colors text-center"
              >
                <p className="text-sm font-medium">{t.profile.avatarClickToUpload}</p>
                <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">{t.profile.avatarClickToUploadHint}</p>
              </button>
            )}
          </div>
        )}

        {tab === 'remove' && (
          <div className="flex flex-col items-center gap-4 py-4">
            {currentSrc ? (
              <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-[var(--color-brand-red)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentSrc} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <X className="w-8 h-8 text-[var(--color-brand-red)]" />
                </div>
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-[var(--color-brand-elevated)] flex items-center justify-center ring-2 ring-[var(--color-brand-border)]">
                <p className="text-xs text-[var(--color-brand-text-muted)]">{t.profile.avatarNoPhoto}</p>
              </div>
            )}
            <p className="text-sm text-[var(--color-brand-text-secondary)] text-center">
              {t.profile.avatarRemoveDesc}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-brand-border)]">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            {t.common.neverMind}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
          >
            {t.profile.avatarUseThis}
          </button>
        </div>
      </div>
    </div>
  )
}
