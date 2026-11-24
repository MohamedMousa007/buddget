import { APP_CLIENT_VERSION } from '@/lib/appVersion'
import { clientPlatform, type ClientPlatform } from '@/lib/clientInfo'

export interface SupportContext {
  appVersion: string
  platform: ClientPlatform
  osVersion?: string
  device?: string
  route?: string
  locale?: string
  timezone?: string
}

/** OS version and device model from a user agent. iOS hides the exact model, so it stays "iPhone" / "iPad". */
export function parseUserAgent(ua: string): { osVersion?: string; device?: string } {
  const android = ua.match(/Android\s([\d.]+)(?:;\s*([^;)]+?))?(?:\sBuild|\)|;)/)
  if (android) {
    const model = android[2]?.trim()
    return { osVersion: `Android ${android[1]}`, device: model && model !== 'K' && !/^wv$/i.test(model) ? model.slice(0, 60) : undefined }
  }
  const ios = ua.match(/(iPhone|iPad|iPod).*?OS\s([\d_]+)/)
  if (ios) return { osVersion: `iOS ${ios[2]!.replace(/_/g, '.')}`, device: ios[1] }
  const mac = ua.match(/Mac OS X\s([\d_]+)/)
  if (mac) return { osVersion: `macOS ${mac[1]!.replace(/_/g, '.')}`, device: 'Mac' }
  const win = ua.match(/Windows NT\s([\d.]+)/)
  if (win) return { osVersion: `Windows ${win[1]}`, device: 'PC' }
  return {}
}

/**
 * What a new conversation carries so the team can help without asking: release, platform, OS, device model, the screen
 * the person was on, language and time zone. Nothing that identifies the person.
 */
export async function collectSupportContext(locale: string, route?: string): Promise<SupportContext> {
  const platform = clientPlatform()
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const parsed = parseUserAgent(ua)
  let osVersion = parsed.osVersion
  if (platform === 'ios') {
    try {
      const { readOsVersion } = await import('@/lib/native/smsTracker')
      const v = await readOsVersion()
      if (v) osVersion = `iOS ${v}`
    } catch {
      /* the UA version stands */
    }
  }
  let timezone: string | undefined
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    timezone = undefined
  }
  return {
    appVersion: APP_CLIENT_VERSION,
    platform,
    osVersion: osVersion?.slice(0, 30),
    device: parsed.device,
    route: (route ?? (typeof window === 'undefined' ? undefined : window.location.pathname))?.slice(0, 80),
    locale: locale.slice(0, 10),
    timezone: timezone?.slice(0, 60),
  }
}
