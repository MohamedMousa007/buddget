import { App } from '@capacitor/app'
import { APP_CLIENT_VERSION } from '@/lib/appVersion'
import { getPlatform, isNative } from '@/lib/native/isNative'
import { getOrCreateDeviceId } from '@/lib/native/deviceId'
import { scrubBreadcrumb, scrubEvent } from './scrub'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const IN_DEV = process.env.NODE_ENV !== 'production'

type SentryModules = {
  Sentry: typeof import('@sentry/capacitor')
  SentryReact: typeof import('@sentry/react')
}

let started = false
let loaded: SentryModules | null = null
let pendingUserId: string | null = null
const pendingErrors: Array<{ error: unknown; area: string }> = []
const MAX_PENDING_ERRORS = 20

/**
 * Starts crash and error reporting once per page load. A no-op without a DSN, on the server, and in development
 * (unless NEXT_PUBLIC_SENTRY_DEV=1), so local work never sends reports. Events are scrubbed on the device first.
 * Sentry loads lazily, only once the guards pass.
 */
export function initCrashReporting(): void {
  if (started || typeof window === 'undefined' || !DSN) return
  if (IN_DEV && process.env.NEXT_PUBLIC_SENTRY_DEV !== '1') return
  started = true
  loadSentry().catch(() => {
    started = false
  })
}

async function loadSentry(): Promise<void> {
  const [Sentry, SentryReact] = await Promise.all([import('@sentry/capacitor'), import('@sentry/react')])
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
  loaded = { Sentry, SentryReact }
  Sentry.setTag('platform', getPlatform())
  Sentry.setUser(pendingUserId ? { id: pendingUserId } : null)
  for (const { error, area } of pendingErrors.splice(0)) SentryReact.captureException(error, { tags: { area } })
  void tagDevice(Sentry)
}

/** Build number and device id arrive asynchronously; they are tags, so a crash before they land still reports. */
async function tagDevice(Sentry: SentryModules['Sentry']): Promise<void> {
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
  pendingUserId = userId
  loaded?.Sentry.setUser(userId ? { id: userId } : null)
}

/** Reports a caught error from an error boundary and returns the id the person can quote to support. */
export function captureAppError(error: unknown, area: string): string | undefined {
  if (loaded) return loaded.SentryReact.captureException(error, { tags: { area } })
  if (started && pendingErrors.length < MAX_PENDING_ERRORS) pendingErrors.push({ error, area })
  return undefined
}
