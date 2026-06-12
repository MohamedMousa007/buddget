'use client'

import { isNative, getPlatform, isIOS } from '@/lib/native/isNative'
import { apiUrl } from '@/lib/apiBase'

// Tracks WHICH account the device is currently registered for. A bare boolean
// (the old design) never reset on account switch, so a second user on the same
// device never got a token. Keyed by userId so a switch re-registers.
let registeredUserId: string | null = null
let listenersAttached = false
// Latest args + token so once-attached listeners (token refresh) post against
// the current session, and logout can unregister the right token.
let currentArgs: RegisterArgs | null = null
let lastToken: string | null = null

interface RegisterArgs {
  /** Supabase JWT bearer token for /api/push/register. */
  accessToken: string
  /** The account this registration belongs to — drives account-switch re-register. */
  userId: string
  /** App language (`'en'|'ar'`) stored per-device for localized push. */
  locale?: string
  /** Optional app version (e.g. `1.0.0`). */
  appVersion?: string
}

/**
 * Registers the device for native push (FCM token on Android, APNS token via
 * Firebase on iOS). Re-registers when the signed-in account changes; otherwise
 * a no-op. Never throws; errors are logged and surfaced via the returned bool.
 */
export async function registerPushNotifications(args: RegisterArgs): Promise<boolean> {
  if (!isNative()) return false
  currentArgs = args
  if (registeredUserId === args.userId) return true
  registeredUserId = args.userId

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') {
      registeredUserId = null
      return false
    }

    if (!listenersAttached) {
      listenersAttached = true

      // Android: @capacitor/push-notifications wraps FCM → registration event
      // gives a valid FCM token. iOS: this event gives an APNs device token,
      // not an FCM token — Firebase Admin SDK rejects APNs tokens. iOS token
      // is fetched explicitly via @capacitor-firebase/messaging below.
      if (!isIOS()) {
        PushNotifications.addListener('registration', (payload) => {
          if (currentArgs) void postToken(payload.value, currentArgs)
        })
      }

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[push] registrationError', err)
      })

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        try {
          window.dispatchEvent(
            new CustomEvent('buddget:push-received', { detail: notification }),
          )
        } catch {
          /* noop */
        }
      })

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        try {
          window.dispatchEvent(
            new CustomEvent('buddget:push-action', { detail: action }),
          )
        } catch {
          /* noop */
        }
      })

      // FCM/APNs tokens rotate. Re-post the refreshed token so the server never
      // pushes to a dead token. Accessed via the plugin proxy (NOT the package's
      // web module, which pulls firebase/messaging and breaks the static build).
      try {
        const { Capacitor } = await import('@capacitor/core')
        const plugins = (Capacitor as unknown as { Plugins: Record<string, unknown> }).Plugins
        const fm = plugins?.['FirebaseMessaging'] as
          | { addListener?: (e: string, cb: (d: { token?: string }) => void) => void }
          | undefined
        if (Capacitor.isPluginAvailable('FirebaseMessaging') && fm?.addListener) {
          fm.addListener('tokenReceived', (d) => {
            if (d?.token && currentArgs) void postToken(d.token, currentArgs)
          })
        }
      } catch (e) {
        console.error('[push] tokenReceived listener failed', e)
      }
    }

    await PushNotifications.register()

    // iOS: @capacitor/push-notifications returns an APNs device token via the
    // `registration` event, but sendNativePush uses Firebase Admin multicast
    // which requires FCM registration tokens. Call the native FirebaseMessaging
    // Capacitor plugin directly (already bundled via @capacitor-firebase/messaging
    // in CapApp-SPM) to get the real FCM token without importing its web module
    // (which pulls in firebase/messaging and breaks the static Next.js build).
    if (isIOS()) {
      try {
        const { Capacitor } = await import('@capacitor/core')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plugins = (Capacitor as unknown as { Plugins: Record<string, unknown> }).Plugins
        if (Capacitor.isPluginAvailable('FirebaseMessaging') && plugins) {
          const result = await (plugins['FirebaseMessaging'] as { getToken: () => Promise<{ token: string }> }).getToken()
          if (result?.token) void postToken(result.token, args)
        }
      } catch (e) {
        console.error('[push] iOS FCM token fetch failed', e)
      }
    }

    return true
  } catch (e) {
    console.error('[push] register failed', e)
    registeredUserId = null
    return false
  }
}

async function postToken(token: string, args: RegisterArgs): Promise<void> {
  lastToken = token
  try {
    await fetch(apiUrl('/api/push/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.accessToken}`,
      },
      body: JSON.stringify({
        token,
        platform: getPlatform(),
        appVersion: args.appVersion,
        locale: args.locale ?? (typeof navigator !== 'undefined' ? navigator.language : null),
        deviceModel:
          typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
      }),
    })
  } catch (e) {
    console.error('[push] postToken failed', e)
  }
}

/**
 * Removes this device's push token from the signed-in account. Call BEFORE
 * sign-out (while the session is still valid) so a logged-out device stops
 * receiving the previous account's pushes. Resets the registration gate so the
 * next account re-registers cleanly.
 */
export async function unregisterPushToken(accessToken: string): Promise<void> {
  const token = lastToken
  registeredUserId = null
  lastToken = null
  if (!isNative() || !token) return
  try {
    await fetch(apiUrl('/api/push/register'), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    })
  } catch (e) {
    console.error('[push] unregister failed', e)
  }
}

/**
 * Schedules a local notification (in-app reminders that don't need a server
 * round-trip — e.g. "Confirm yesterday's coffee?"). Falls back silently on web.
 */
export async function scheduleLocalNotification(opts: {
  title: string
  body: string
  /** Defer by N seconds; defaults to immediate. */
  inSeconds?: number
  /** Stable id so the same reminder isn't duplicated. */
  id?: number
  extra?: Record<string, unknown>
}): Promise<void> {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      const r = await LocalNotifications.requestPermissions()
      if (r.display !== 'granted') return
    }

    const at = opts.inSeconds && opts.inSeconds > 0
      ? new Date(Date.now() + opts.inSeconds * 1000)
      : null

    await LocalNotifications.schedule({
      notifications: [
        {
          id: opts.id ?? Math.floor(Math.random() * 1_000_000),
          title: opts.title,
          body: opts.body,
          schedule: at ? { at } : undefined,
          extra: opts.extra,
        },
      ],
    })
  } catch (e) {
    console.error('[push] local notif failed', e)
  }
}
