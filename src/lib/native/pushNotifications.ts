'use client'

import { isNative, getPlatform, isIOS } from '@/lib/native/isNative'
import { apiUrl } from '@/lib/apiBase'

let registered = false
let listenersAttached = false

interface RegisterArgs {
  /** Supabase JWT bearer token for /api/push/register. */
  accessToken: string
  /** Optional locale string (e.g. `en-EG`). */
  locale?: string
  /** Optional app version (e.g. `1.0.0`). */
  appVersion?: string
}

/**
 * Registers the device for native push (FCM token on Android, APNS token via
 * Firebase on iOS). Safe to call multiple times — second invocation is a
 * no-op. Never throws; errors are logged and surfaced via the returned bool.
 */
export async function registerPushNotifications(args: RegisterArgs): Promise<boolean> {
  if (!isNative()) return false
  if (registered) return true
  registered = true

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') {
      registered = false
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
          void postToken(payload.value, args)
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
    registered = false
    return false
  }
}

async function postToken(token: string, args: RegisterArgs): Promise<void> {
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
