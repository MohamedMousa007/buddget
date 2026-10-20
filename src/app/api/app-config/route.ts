import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getMinVersions } from '@/lib/server/clientGate'

/** What every app needs before it signs in: the minimum release (and where to get it), maintenance, announcement. Public, cached briefly. */
export async function GET() {
  const min = await getMinVersions()
  let rest: Record<string, unknown> = {}
  try {
    const { data } = await createServiceRoleClient().from('platform_settings').select('key, value').in('key', ['maintenance', 'announcement'])
    rest = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
  } catch {
    /* the app works without them */
  }
  return NextResponse.json(
    { min: { ios: min.ios, android: min.android }, updateUrl: { ios: min.iosUrl, android: min.androidUrl }, ...rest },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
