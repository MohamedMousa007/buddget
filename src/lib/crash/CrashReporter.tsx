'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { initCrashReporting, setCrashUser } from './init'

// Runs when the bundle loads, before any effect, so errors during first render are captured.
initCrashReporting()

/** Keeps the crash reporter's user in step with the signed-in account. */
export function CrashReporter() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  useEffect(() => {
    setCrashUser(userId)
  }, [userId])
  return null
}
