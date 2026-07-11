'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { navigate } from '@/lib/navigation/navigate'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useLocale, useT } from '@/lib/i18n'
import { isSupabaseConfigured } from '@/lib/supabase/env'

import { apiFetchAuth } from '@/lib/apiBase'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'

const INPUT_CLASS =
  'bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] focus:border-[var(--color-brand-focus)] rounded-xl px-3 py-2 text-[var(--color-brand-text-primary)] text-sm w-full outline-none transition-colors'

type ProfileForm = { name: string; email: string; phone: string; country: string; city: string }

/**
 * Profile route: identity edit form, avatar modal trigger, password reset, sign-out.
 */
export function useProfilePage() {
  const t = useT()
  const { locale } = useLocale()
  const { user, signOut } = useAuth()
  const store = useFinanceStore()

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

  const handlePasswordReset = useCallback(() => {
    // The user is already authenticated, so the reset-password page renders the
    // new-password form directly off the live session and updates via
    // updateUser — fully in-app, no email/OTP round-trip, works on native.
    navigate('/reset-password/confirm')
  }, [])

  const handleSignOut = useCallback(async () => {
    // signOut owns ALL teardown (store wipe, push unregister, session clear).
    // Do NOT call clearBudgetData() here — that flips dataReady=false while mode
    // is still 'authenticated' and trips the 2.5s loading splash on logout.
    await signOut()
  }, [signOut])

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState(false)

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
      const res = await apiFetchAuth('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || t.profile.deleteAccountError)
      }
      // Show the success overlay FIRST (z-[200], covers the authenticated dashboard).
      // Calling signOut() here sets user=null → AuthProvider unmounts {children}
      // before AccountDeletedScreen ever renders. The screen's "Go Home" button
      // calls supabase.auth.signOut({ scope:'local' }) then window.location.assign('/')
      // which hard-reloads to the landing gate with a clean slate.
      setDeleteOpen(false)
      setDeleteSuccess(true)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t.profile.deleteAccountError)
      setDeleting(false)
    }
  }, [t.profile.deleteAccountError])

  const supabaseConfigured = useMemo(
    () =>
      isSupabaseConfigured(),
    []
  )

  return {
    t,
    locale,
    user,
    store,
    editMode,
    avatarModalOpen,
    setAvatarModalOpen,
    form,
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
    supabaseConfigured,
    deleteOpen,
    deleting,
    deleteError,
    deleteSuccess,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  }
}
