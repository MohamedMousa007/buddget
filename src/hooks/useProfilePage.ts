'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useLocale, useT } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'

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
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
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
  }
}
