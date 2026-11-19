import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

export interface Wire { method: string; path: string; status: number; body: string; reqBody: string }

/** A signed-in client for a synthetic QA user that records every PostgREST request/response (bodies kept for the report, tokens never). */
export async function liveClient(email: string): Promise<{ client: SupabaseClient; userId: string; wire: Wire[] }> {
  const password = process.env.QA_SYNC_PW
  if (!password) throw new Error('QA_SYNC_PW not set')
  const wire: Wire[] = []
  const recordingFetch: typeof fetch = async (input, init) => {
    const res = await fetch(input, init)
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.pathname.startsWith('/rest/')) {
      const body = await res.clone().text()
      wire.push({
        method: init?.method ?? 'GET',
        path: url.pathname + (url.search ? url.search.slice(0, 160) : ''),
        status: res.status,
        body: body.slice(0, 600),
        reqBody: typeof init?.body === 'string' ? init.body.slice(0, 1200) : '',
      })
    }
    return res
  }
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: recordingFetch },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(`sign-in failed: ${error?.message}`)
  return { client, userId: data.user.id, wire }
}
