import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

/**
 * Shape passed by @supabase/ssr to cookie `setAll` (explicit for strict TS / Vercel).
 */
export type SupabaseCookieToSet = {
  name: string
  value: string
  options?: Partial<ResponseCookie>
}
