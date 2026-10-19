'use client'

import { useMemo, useState } from 'react'
import { Camera, Check, Images, Trash2, X, TriangleAlert } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { ColorSwatchRow } from '@/components/ui/ColorSwatchRow'
import { IconButton } from '@/components/ui/IconButton'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { PhotoCropper } from '@/components/profile/PhotoCropper'
import { ReceiptCaptureCancelled, capturePhoto } from '@/lib/native/cameraScanner'
import {
  AVATAR_BACKGROUNDS,
  AVATAR_GROUPS,
  AVATAR_PRESETS,
  DEFAULT_AVATAR_ID,
  avatarDataUri,
  encodeAvatarId,
  parseAvatarId,
  resolveAvatarId,
  type AvatarGroup,
} from '@/lib/profile/avatarArt'
import { checkAvatarFile, loadImage, renderAvatarJpeg, type CropState } from '@/lib/profile/avatarPhoto'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { isValidImageDataUrl } from '@/lib/profile/validImageDataUrl'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { FinanceStore } from '@/lib/store/types'

type Tab = 'avatars' | 'photo'
type GroupFilter = 'all' | AvatarGroup
type Problem = 'perm' | 'big' | 'badType' | 'failed'

interface AvatarPickerModalProps {
  open: boolean
  onClose: () => void
  store: FinanceStore
}

export function AvatarPickerModal({ open, onClose, store }: AvatarPickerModalProps) {
  const t = useT()
  const confirm = useConfirm()
  const { profile } = store

  const initial = useMemo(() => {
    const raw = profile.avatarPresetId
    return { id: resolveAvatarId(raw) ?? DEFAULT_AVATAR_ID, bg: raw ? parseAvatarId(raw).bg : undefined }
  }, [profile.avatarPresetId])

  const [tab, setTab] = useState<Tab>(profile.avatar ? 'photo' : 'avatars')
  const [group, setGroup] = useState<GroupFilter>('all')
  const [selected, setSelected] = useState(initial.id)
  const [bg, setBg] = useState<string | undefined>(initial.bg)
  const [pending, setPending] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropState | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [busy, setBusy] = useState(false)

  // Start each opening from the saved profile, not from whatever the last session left behind.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTab(profile.avatar ? 'photo' : 'avatars')
      setGroup('all')
      setSelected(initial.id)
      setBg(initial.bg)
      setPending(null)
      setCrop(null)
      setProblem(null)
      setBusy(false)
    }
  }

  const close = onClose

  const groupLabel: Record<GroupFilter, string> = {
    all: t.profile.avatarGroupAll,
    crew: t.profile.avatarGroupCrew,
    people: t.profile.avatarGroupPeople,
    headwear: t.profile.avatarGroupHeadwear,
    toon: t.profile.avatarGroupToon,
    explorer: t.profile.avatarGroupExplorer,
    ears: t.profile.avatarGroupEars,
    emoji: t.profile.avatarGroupEmoji,
  }
  const visible = AVATAR_PRESETS.filter((p) => group === 'all' || p.group === group)
  const bgByHex = new Map(AVATAR_BACKGROUNDS.map((b) => [b.main, b.key]))
  const bgHex = AVATAR_BACKGROUNDS.find((b) => b.key === bg)?.main ?? ''

  const showingPhoto = tab === 'photo' && pending !== null
  const currentPhotoSrc = tab === 'photo' && profile.avatar ? resolveProfileAvatarSrc({ avatar: profile.avatar }) : null
  const previewSrc = showingPhoto
    ? pending
    : currentPhotoSrc ?? avatarDataUri(encodeAvatarId(selected, bg))
  const previewName = showingPhoto || currentPhotoSrc
    ? t.profile.avatarTabPhoto
    : AVATAR_PRESETS.find((p) => p.id === selected)?.label

  const pick = async (source: 'camera' | 'gallery') => {
    setProblem(null)
    try {
      const shot = await capturePhoto(source)
      const check = checkAvatarFile(shot.file)
      if (check !== 'ok') {
        setProblem(check === 'tooBig' ? 'big' : 'badType')
        return
      }
      setCrop(null)
      setPending(shot.dataUrl)
    } catch (e) {
      if (e instanceof ReceiptCaptureCancelled) return
      setProblem(/denied|permission/i.test(String(e instanceof Error ? e.message : e)) ? 'perm' : 'failed')
    }
  }

  const useAvatar = () => {
    store.updateProfile({ avatarPresetId: encodeAvatarId(selected, bg), avatar: undefined })
    close()
  }

  const usePhoto = async () => {
    if (!pending || !crop) return
    setBusy(true)
    try {
      const img = await loadImage(pending)
      const url = renderAvatarJpeg(img, crop)
      if (!isValidImageDataUrl(url)) throw new Error('invalid')
      store.updateProfile({ avatar: url })
      close()
    } catch {
      setPending(null)
      setProblem('failed')
    } finally {
      setBusy(false)
    }
  }

  const removePhoto = async () => {
    const ok = await confirm({
      title: t.profile.avatarRemove,
      body: t.profile.avatarRemoveHint,
      confirmLabel: t.profile.avatarRemove,
      destructive: true,
    })
    if (!ok) return
    store.updateProfile({ avatar: undefined })
    setTab('avatars')
  }

  const problemCopy: Record<Problem, { title: string; body: string }> = {
    perm: { title: t.profile.avatarCameraBlockedTitle, body: t.profile.avatarCameraBlockedBody },
    big: { title: t.profile.avatarTooBigTitle, body: t.profile.avatarTooBigBody },
    badType: { title: t.profile.avatarBadTypeTitle, body: t.profile.avatarBadTypeBody },
    failed: { title: t.profile.avatarFailedTitle, body: t.profile.avatarFailedBody },
  }

  return (
    <ModalShell open={open} onBackdropClick={close} scrollChild panelClassName="md:w-[440px] max-h-[92dvh]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-1">
          <h2 className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{t.profile.avatarModalTitle}</h2>
          <IconButton aria-label={t.common.close} variant="tinted" size="sm" shape="round" onClick={close}>
            <X />
          </IconButton>
        </div>

        <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <div className="flex flex-col items-center gap-1.5 py-2">
            <div className="size-28 overflow-hidden rounded-full bg-[var(--color-brand-elevated)] p-1 ring-2 ring-[var(--color-brand-primary)]">
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewSrc} alt="" className="size-full rounded-full object-cover" width={112} height={112} />
              ) : null}
            </div>
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{previewName}</p>
          </div>

          <SegmentedControl<Tab>
            ariaLabel={t.profile.avatarModalTitle}
            value={tab}
            onChange={(v) => { setTab(v); setProblem(null) }}
            options={[
              { value: 'avatars', label: t.profile.avatarTabAvatars },
              { value: 'photo', label: t.profile.avatarTabPhoto },
            ]}
          />

          {tab === 'avatars' ? (
            <div className="mt-4 space-y-4">
              <div className="native-scroll -mx-1 flex gap-2 overflow-x-auto px-1">
                {(['all', ...AVATAR_GROUPS] as const).map((g) => (
                  <OptionChip key={g} size="sm" selected={group === g} onClick={() => setGroup(g)}>
                    {groupLabel[g]}
                  </OptionChip>
                ))}
              </div>

              <div role="radiogroup" aria-label={t.profile.avatarTabAvatars} className="grid max-h-[300px] grid-cols-5 gap-2.5 overflow-y-auto p-1">
                {visible.map((p) => {
                  const on = selected === p.id
                  return (
                    <SelectableCard
                      key={p.id}
                      as="radio"
                      title={p.label}
                      aria-label={p.label}
                      selected={on}
                      onClick={() => setSelected(p.id)}
                      className={cn('relative aspect-square min-h-11 overflow-hidden rounded-full border-2 p-0 transition-transform', on && 'scale-105')}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarDataUri(encodeAvatarId(p.id, bg)) ?? ''} alt="" className="size-full object-cover" width={64} height={64} />
                      {on ? (
                        <span className="absolute bottom-0 end-0 flex size-5 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">
                          <Check className="size-3" strokeWidth={3} aria-hidden />
                        </span>
                      ) : null}
                    </SelectableCard>
                  )
                })}
              </div>

              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-brand-text-muted)]">{t.profile.avatarBackground}</p>
                <ColorSwatchRow
                  value={bgHex}
                  colors={AVATAR_BACKGROUNDS.map((b) => b.main)}
                  onChange={(hex) => setBg(bgByHex.get(hex))}
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {problem ? (
                <div role="alert" className="flex gap-3 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3.5">
                  <TriangleAlert className="mt-0.5 size-5 shrink-0 text-[var(--color-brand-primary-ink)]" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{problemCopy[problem].title}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--color-brand-text-secondary)]">{problemCopy[problem].body}</p>
                  </div>
                </div>
              ) : null}

              {pending ? (
                <>
                  <p className="text-center text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.profile.avatarFrameTitle}</p>
                  <p className="text-center text-xs text-[var(--color-brand-text-muted)]">{t.profile.avatarFrameHint}</p>
                  <PhotoCropper src={pending} onChange={setCrop} />
                  <Button variant="outline" size="touch" className="w-full" onClick={() => { setPending(null); setCrop(null) }}>
                    {t.profile.avatarChooseAgain}
                  </Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectableCard as="action" layout="tile" onClick={() => pick('camera')}>
                      <Camera className="size-6 text-[var(--color-brand-primary-ink)]" aria-hidden />
                      <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.profile.avatarTakePhoto}</span>
                      <span className="text-xs text-[var(--color-brand-text-muted)]">{t.profile.avatarTakePhotoHint}</span>
                    </SelectableCard>
                    <SelectableCard as="action" layout="tile" onClick={() => pick('gallery')}>
                      <Images className="size-6 text-[var(--color-brand-primary-ink)]" aria-hidden />
                      <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.profile.avatarChoosePhoto}</span>
                      <span className="text-xs text-[var(--color-brand-text-muted)]">{t.profile.avatarChoosePhotoHint}</span>
                    </SelectableCard>
                  </div>
                  <p className="text-center text-xs text-[var(--color-brand-text-muted)]">{t.profile.avatarResizeHint}</p>
                  {profile.avatar ? (
                    <Button variant="destructive" size="touch" className="w-full" onClick={removePhoto}>
                      <Trash2 aria-hidden />
                      {t.profile.avatarRemove}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[var(--color-brand-border)] px-5 pb-5 pt-3">
          <Button variant="outline" size="touch" className="flex-1" onClick={close}>
            {t.common.neverMind}
          </Button>
          {tab === 'avatars' ? (
            <Button size="touch" className="flex-[1.4] font-semibold" onClick={useAvatar}>
              {t.profile.avatarUseAvatar}
            </Button>
          ) : (
            <Button size="touch" className="flex-[1.4] font-semibold" disabled={!pending || !crop || busy} onClick={usePhoto}>
              {busy ? t.profile.avatarProcessing : t.profile.avatarUseThis}
            </Button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
