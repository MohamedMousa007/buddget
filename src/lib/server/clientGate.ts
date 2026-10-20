import { NextResponse } from 'next/server'
import { isVersionBelow } from '@/lib/appVersion'
import { createServiceRoleClient } from '@/lib/supabase/service'

export interface MinVersions {
  ios: string
  android: string
  iosUrl: string
  androidUrl: string
}

const NATIVE_ORIGINS = new Set(['https://localhost', 'capacitor://localhost'])

/**
 * Mirrors the database gate (`app_client_gate`) for our own API routes. Web and server-to-server callers pass.
 * A native release that predates the version header is recognised by the WebView origin and counts as 0.0.0.
 */
export function mustUpdate(req: Request, min: MinVersions): boolean {
  let platform = (req.headers.get('x-app-platform') ?? '').toLowerCase()
  let version = req.headers.get('x-app-version')
  if (!platform) {
    if (!NATIVE_ORIGINS.has(req.headers.get('origin') ?? '')) return false
    platform = /android/i.test(req.headers.get('user-agent') ?? '') ? 'android' : 'ios'
    version = '0.0.0'
  }
  if (platform !== 'ios' && platform !== 'android') return false
  return isVersionBelow(version, min[platform])
}

let cached: { at: number; value: MinVersions } | null = null
const TTL_MS = 60_000

export async function getMinVersions(now = Date.now()): Promise<MinVersions> {
  if (cached && now - cached.at < TTL_MS) return cached.value
  let value: MinVersions = { ios: '', android: '', iosUrl: '', androidUrl: '' }
  try {
    const { data } = await createServiceRoleClient().from('platform_settings').select('value').eq('key', 'min_app_version').maybeSingle()
    const v = (data?.value ?? {}) as Record<string, unknown>
    const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '')
    value = { ios: s('ios'), android: s('android'), iosUrl: s('ios_url'), androidUrl: s('android_url') }
  } catch (e) {
    console.warn('[clientGate] settings read failed', e instanceof Error ? e.message : e)
  }
  cached = { at: now, value }
  return value
}

/** First line of a protected route: answers 426 to a release below the minimum, otherwise null. */
export async function gateOutdatedClient(req: Request): Promise<NextResponse | null> {
  const platform = req.headers.get('x-app-platform')
  // Web and server callers (no native signature) never need the settings lookup.
  if (platform === 'web' || (!platform && !NATIVE_ORIGINS.has(req.headers.get('origin') ?? ''))) return null
  const min = await getMinVersions()
  if (!mustUpdate(req, min)) return null
  return NextResponse.json({ error: 'update_required', code: 'update_required' }, { status: 426, headers: { 'Cache-Control': 'no-store', 'X-Update-Required': 'true' } })
}
