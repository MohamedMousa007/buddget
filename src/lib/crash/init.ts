import * as Sentry from '@sentry/capacitor'
import * as SentryReact from '@sentry/react'
import { App } from '@capacitor/app'
import { APP_CLIENT_VERSION } from '@/lib/appVersion'
import { getPlatform, isNative } from '@/lib/native/isNative'
import { getOrCreateDeviceId } from '@/lib/native/deviceId'
import { scrubBreadcrumb, scrubEvent } from './scrub'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const IN_DEV = process.env.NODE_ENV !== 'production'

let started = false

/**
 * Starts crash and error reporting once per page load. A no-op without a DSN, on the server, and in development
 * (unless NEXT_PUBLIC_SENTRY_DEV=1), so local work never sends reports. Events are scrubbed on the device first.
 */
export function initCrashReporting(): void {
  if (started || typeof window === 'undefined' || !DSN) return
  if (IN_DEV && process.env.NEXT_PUBLIC_SENTRY_DEV !== '1') return
  started = true

  Sentry.init(
    {
      dsn: DSN,
      release: `buddget@${APP_CLIENT_VERSION}`,
      environment: IN_DEV ? 'development' : 'production',
      enableNative: isNative(),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (b) => scrubBreadcrumb(b),
    },
    SentryReact.init,
  )
  Sentry.setTag('platform', getPlatform())
  void tagDevice()
}

/** Build number and device id arrive asynchronously; they are tags, so a crash before they land still reports. */
async function tagDevice(): Promise<void> {
  if (isNative()) {
    try {
      const info = await App.getInfo()
      Sentry.setTag('build', info.build)
    } catch {
      /* the release still carries the version */
    }
  }
  const id = await getOrCreateDeviceId()
  if (id) Sentry.setTag('device_id', id)
}

/** Ties reports to the signed-in account by its opaque id (never the email), and clears it on sign-out. */
export function setCrashUser(userId: string | null): void {
  if (!started) return
  Sentry.setUser(userId ? { id: userId } : null)
}

/** Reports a caught error from an error boundary and returns the id the person can quote to support. */
export function captureAppError(error: unknown, area: string): string | undefined {
  if (!started) return undefined
  return SentryReact.captureException(error, { tags: { area } })
}
