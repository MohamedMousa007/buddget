import { Capacitor } from '@capacitor/core'
import { APP_CLIENT_VERSION } from '@/lib/appVersion'

export const UPDATE_REQUIRED_EVENT = 'buddget:update-required'

export type ClientPlatform = 'ios' | 'android' | 'web'

export function clientPlatform(): ClientPlatform {
  try {
    const p = Capacitor.getPlatform()
    return p === 'ios' || p === 'android' ? p : 'web'
  } catch {
    return 'web'
  }
}

function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

let installed = false

/**
 * Every request this app makes to our own API or to Supabase says which release it is (x-app-platform, x-app-version).
 * One place, so no code path can forget it. A 426 answer means this release is too old: the update gate takes over.
 */
export function installClientHeaders(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const targets = new Set([originOf(process.env.NEXT_PUBLIC_SUPABASE_URL), originOf(process.env.NEXT_PUBLIC_API_BASE_URL), window.location.origin].filter((o): o is string => !!o))
  const platform = clientPlatform()
  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    let url = ''
    try {
      url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const origin = new URL(url, window.location.origin).origin
      if (targets.has(origin)) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        headers.set('x-app-platform', platform)
        headers.set('x-app-version', APP_CLIENT_VERSION)
        init = { ...init, headers }
      }
    } catch {
      /* not a URL we understand: send it untouched */
    }
    const res = await nativeFetch(input, init)
    if (res.status === 426) window.dispatchEvent(new Event(UPDATE_REQUIRED_EVENT))
    return res
  }
}

installClientHeaders()
