'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useLocale, useT } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import {
  getOnboardingCompletionPercent,
  isExpertOnboardingComplete,
  getOnboardingStageRows,
  onboardingProgressSnapshotFromStore,
} from '@/lib/onboarding/onboardingProgress'

const INPUT_CLASS =
  'bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] focus:border-[var(--color-brand-red)] rounded-xl px-3 py-2 text-[var(--color-brand-text-primary)] text-sm w-full outline-none transition-colors'

type ProfileForm = { name: string; email: string; phone: string; country: string; city: string }

/**
 * Profile route: identity edit form, avatar modal trigger, password reset, sign-out.
 */
export function useProfilePage() {
  const t = useT()
  const { locale } = useLocale()
  const { user, signOut } = useAuth()
  const store = useFinanceStore()
  const router = useRouter()

  useEffect(() => {
    if (user?.email) {
      useFinanceStore.getState().updateProfile({ email: user.email })
    }
  }, [user?.email])

  const [editMode, setEditMode] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [form, setForm] = useState<ProfileForm>({
    name: '',
    email: '',
    phone: '',
    country: '',
    city: '',
  })
  const [resetSent, setResetSent] = useState(false)

  const avatarSrc = resolveProfileAvatarSrc(store.profile)
  const displayName = store.profile.name || t.profile.displayNameFallback
  const displayEmail = user?.email || store.profile.email || ''

  const enterEditMode = useCallback(() => {
    setForm({
      name: store.profile.name,
      email: store.profile.email || user?.email || '',
      phone: store.profile.phone || '',
      country: store.profile.country || '',
      city: store.profile.city || '',
    })
    setEditMode(true)
  }, [store.profile, user?.email])

  const discard = useCallback(() => setEditMode(false), [])

  const save = useCallback(() => {
    store.updateProfile({
      name: form.name,
      phone: form.phone,
      country: form.country,
      city: form.city,
    })
    if (!user) store.updateProfile({ email: form.email })
    setEditMode(false)
  }, [form, store, user])

  const updateField = useCallback((field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handlePasswordReset = useCallback(async () => {
    const email = user?.email
    if (!email) return
    try {
      const supabase = createClient()
      const { isNative } = await import('@/lib/native/isNative')
      const { NATIVE_AUTH_SCHEME } = await import('@/lib/native/nativeAuthScheme')
      const resetRedirect = isNative()
        ? `${NATIVE_AUTH_SCHEME}://auth/callback?next=/reset-password/confirm`
        : `${window.location.origin}/reset-password/confirm`
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirect,
      })
      setResetSent(true)
      setTimeout(() => setResetSent(false), 5000)
    } catch {
      // silently fail
    }
  }, [user?.email])

  const handleSignOut = useCallback(async () => {
    clearBudgetData()
    await signOut()
    router.push('/')
  }, [router, signOut])

  const redoOnboarding = useCallback(() => {
    router.push('/onboarding?redo=1')
  }, [router])

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const openDeleteDialog = useCallback(() => {
    setDeleteError(null)
    setDeleteOpen(true)
  }, [])
  const closeDeleteDialog = useCallback(() => {
    if (deleting) return
    setDeleteOpen(false)
    setDeleteError(null)
  }, [deleting])

  const confirmDelete = useCallback(async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || t.profile.deleteAccountError)
      }
      // Clear local state, sign out server-side, and land the user on the marketing home.
      clearBudgetData()
      try {
        await signOut()
      } catch {
        // ignore sign-out failure — the auth user is already deleted
      }
      // Hard navigation so the middleware + Supabase client re-initialise cleanly.
      if (typeof window !== 'undefined') {
        window.location.assign('/')
      } else {
        router.replace('/')
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t.profile.deleteAccountError)
      setDeleting(false)
    }
  }, [router, signOut, t.profile.deleteAccountError])

  const supabaseConfigured = useMemo(
    () =>
      isSupabaseConfigured(),
    []
  )

  const onboardingPct = getOnboardingCompletionPercent(store, t)
  const onboardingStages = getOnboardingStageRows(onboardingProgressSnapshotFromStore(store), t)
  // Source of truth for "is this user done with onboarding?" is the
  // Supabase `user_metadata.onboarding_completed` flag — flipped by
  // `/api/auth/complete-journey`. Falling back to the legacy
  // `isExpertOnboardingComplete(...)` check for guest mode + users who
  // completed via the legacy core-gate path.
  const onboardingDone =
    user?.user_metadata?.onboarding_completed === true ||
    isExpertOnboardingComplete(store.onboardingState)

  return {
    t,
    locale,
    user,
    store,
    editMode,
    avatarModalOpen,
    setAvatarModalOpen,
    form,
    resetSent,
    avatarSrc,
    displayName,
    displayEmail,
    inputClass: INPUT_CLASS,
    enterEditMode,
    discard,
    save,
    updateField,
    handlePasswordReset,
    handleSignOut,
    redoOnboarding,
    supabaseConfigured,
    onboardingPct,
    onboardingStages,
    onboardingDone,
    deleteOpen,
    deleting,
    deleteError,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  }
}
