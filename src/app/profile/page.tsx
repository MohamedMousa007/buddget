'use client'

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Settings, ClipboardList, CheckCircle2, CircleDashed } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CARTOON_AVATAR_PRESETS, cartoonAvatarUrlForPreset } from '@/lib/onboarding/cartoonAvatars'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import {
  getOnboardingCompletionPercent,
  getOnboardingStageRows,
  isExpertOnboardingComplete,
  onboardingProgressSnapshotFromStore,
} from '@/lib/onboarding/onboardingProgress'
import { cn } from '@/lib/utils'
import { ProfileBudgetSection } from '@/components/profile/ProfileBudgetSection'

const AVATAR_FILE_MAX_BYTES = 2 * 1024 * 1024

export default function ProfilePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const { user, openAuthModal } = useAuth()
  const store = useFinanceStore()
  const supabaseConfigured = useMemo(
    () =>
      !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    []
  )

  useEffect(() => {
    if (user?.email) {
      useFinanceStore.getState().updateProfile({ email: user.email })
    }
  }, [user?.email])

  const pct = getOnboardingCompletionPercent(store)
  const expertDone = isExpertOnboardingComplete(store.onboardingState)
  const onboardingStages = getOnboardingStageRows(onboardingProgressSnapshotFromStore(store))

  const activePreset = store.profile.avatarPresetId

  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > AVATAR_FILE_MAX_BYTES) {
      window.alert('Please choose an image under 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result
      if (typeof data === 'string') {
        store.updateProfile({ avatar: data, avatarPresetId: undefined })
      }
    }
    reader.readAsDataURL(file)
  }

  const goOnboarding = () => {
    if (supabaseConfigured && !user) {
      openAuthModal('/onboarding?redo=1')
      return
    }
    router.push('/onboarding?redo=1')
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-[var(--color-brand-red)]" />
            Profile
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-3xl mx-auto">
        <p className="text-sm text-[var(--color-brand-text-muted)]">
          Your account and budget live here. For currencies, AI, backups, and app preferences, open{' '}
          <Link href="/settings" className="text-[var(--color-brand-red)] hover:underline inline-flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>
          .
        </p>

        <section className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            Photo
          </h2>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">
            Cartoon avatars below, or upload a photo from your device (gallery or files).
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
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            Upload photo…
          </button>
          {store.profile.avatar?.startsWith('data:') ? (
            <button
              type="button"
              onClick={() => store.updateProfile({ avatar: undefined })}
              className="block text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
            >
              Remove uploaded photo
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

        <section className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            Personal details
          </h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Name</Label>
              <Input
                value={store.profile.name}
                onChange={(e) => store.updateProfile({ name: e.target.value })}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">
                Email {user ? '(from account)' : ''}
              </Label>
              <Input
                value={store.profile.email || ''}
                onChange={(e) => {
                  if (!user) store.updateProfile({ email: e.target.value })
                }}
                readOnly={!!user}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white read-only:opacity-80"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Phone (optional)</Label>
              <Input
                value={store.profile.phone || ''}
                onChange={(e) => store.updateProfile({ phone: e.target.value })}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Country</Label>
              <Input
                value={store.profile.country || ''}
                onChange={(e) => store.updateProfile({ country: e.target.value })}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">City</Label>
              <Input
                value={store.profile.city || ''}
                onChange={(e) => store.updateProfile({ city: e.target.value })}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
              />
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-5 space-y-4 border border-[var(--color-brand-border)]/80">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[var(--color-brand-red)]" />
            <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
              Onboarding
            </h2>
          </div>
          {expertDone ? (
            <p className="text-sm text-[var(--color-brand-text-muted)]">
              You’ve finished onboarding. Run it again anytime to refresh answers and get new suggested budget plans —
              your data will be prefilled.
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--color-brand-text-muted)]">
                Progress reflects survey answers and data you’ve already entered in the app (income, budgets, debts, and
                payment methods).
              </p>
              <Progress value={pct} className="gap-1">
                <ProgressTrack className="h-1.5 bg-[var(--color-brand-border)]">
                  <ProgressIndicator className="bg-[var(--color-brand-red)]" />
                </ProgressTrack>
              </Progress>
              <p className="text-[11px] text-[var(--color-brand-text-muted)]">{pct}% complete</p>
              <ul className="space-y-2 pt-1">
                {onboardingStages.map((row) => (
                  <li key={row.id} className="flex items-start gap-2">
                    {row.status === 'complete' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                    ) : (
                      <CircleDashed className="w-4 h-4 text-[var(--color-brand-text-muted)] shrink-0 mt-0.5" aria-hidden />
                    )}
                    <div>
                      <p className="text-xs font-medium text-white">{row.label}</p>
                      <p className="text-[10px] text-[var(--color-brand-text-muted)]">{row.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={goOnboarding}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
          >
            Complete onboarding
          </button>
          {supabaseConfigured && !user ? (
            <p className="text-[11px] text-[var(--color-brand-text-muted)]">
              Sign up or log in first — your account is required to save onboarding and sync it.
            </p>
          ) : null}
        </section>

        <ProfileBudgetSection />
      </div>
    </div>
  )
}
