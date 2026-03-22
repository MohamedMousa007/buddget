import type { User } from '@supabase/supabase-js'

/** After sign-in / sign-up, send new users to onboarding before the rest of the app. */
export function routeAfterAuth(user: User | null, preferredNext: string): string {
  if (!user) return preferredNext
  if (user.user_metadata?.onboarding_completed === true) return preferredNext
  return '/onboarding'
}
