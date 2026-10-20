'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { apiFetchAuth } from '@/lib/apiBase'

/**
 * Whether the signed-in account is on the admin team, which decides if the portal shortcut shows in the header.
 * Looked up once per account and remembered for the page's lifetime. The server answers `isStaff: false` for
 * everyone else, so a non-staff user's request reveals nothing and fails closed on any error.
 */
const cache = new Map<string, boolean>()

export function useStaffAccess(): boolean {
  const { user } = useAuth()
  const uid = user?.id ?? null
  // Only accounts the server has already marked as staff ask: everyone else never calls an admin endpoint.
  const flagged = user?.app_metadata?.is_staff === true
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!uid || !flagged || cache.has(uid)) return
    let live = true
    apiFetchAuth('/api/admin/auth/status')
      .then((res) => (res.ok ? (res.json() as Promise<{ isStaff?: boolean }>) : { isStaff: false }))
      .catch(() => ({ isStaff: false }))
      .then((body) => {
        cache.set(uid, body.isStaff === true)
        if (live) setTick((n) => n + 1)
      })
    return () => { live = false }
  }, [uid, flagged])

  return uid ? (cache.get(uid) ?? false) : false
}
