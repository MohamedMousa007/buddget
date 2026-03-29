'use client'

import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import {
  getOnboardingCompletionPercent,
  getOnboardingStageRows,
  isExpertOnboardingComplete,
  onboardingProgressSnapshotFromStore,
} from '@/lib/onboarding/onboardingProgress'

const AVATAR_FILE_MAX_BYTES = 2 * 1024 * 1024

/**
 * Profile screen: avatar upload, onboarding progress, navigation to redo flow.
 */
export function useProfilePage() {
  const t = useT()
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

  const pct = getOnboardingCompletionPercent(store, t)
  const expertDone = isExpertOnboardingComplete(store.onboardingState)
  const onboardingStages = getOnboardingStageRows(onboardingProgressSnapshotFromStore(store), t)
  const activePreset = store.profile.avatarPresetId

  const onAvatarFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !file.type.startsWith('image/')) return
      if (file.size > AVATAR_FILE_MAX_BYTES) {
        window.alert(t.profile.avatarTooLarge)
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
    },
    [store, t]
  )

  const goOnboarding = useCallback(() => {
    if (supabaseConfigured && !user) {
      openAuthModal('/onboarding?redo=1')
      return
    }
    router.push('/onboarding?redo=1')
  }, [openAuthModal, router, supabaseConfigured, user])

  return {
    store,
    user,
    fileRef,
    supabaseConfigured,
    pct,
    expertDone,
    onboardingStages,
    activePreset,
    onAvatarFile,
    goOnboarding,
  }
}
