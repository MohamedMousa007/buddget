'use client'

import { useAuth } from '@/components/auth/AuthProvider'

/**
 * Whether the signed-in account is on the admin team, which decides if the badge and portal shortcut show. The server
 * stamps `is_staff` into the account's own app metadata (users cannot write it), so it is already in the cached session:
 * no request, no wait. The portal and every admin endpoint still check access server-side.
 */
export function useStaffAccess(): boolean {
  const { user } = useAuth()
  return user?.app_metadata?.is_staff === true
}
