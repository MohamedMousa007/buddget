/**
 * Server-side Web Push dispatch helper.
 *
 * Loads all push subscriptions for a user and fans the notification out to each one.
 * Stale subscriptions that return HTTP 410 (Gone) are automatically pruned.
 *
 * This is intentionally decoupled from the SMS feature so future notification
 * types (debt reminders, budget alerts) can reuse it.
 */

import webPush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '@/lib/notifications/vapid'

export interface WebPushPayload {
  title: string
  body: string
  /** SMS event id — used by the service worker to wire the Undo action. */
  smsEventId?: string
  /** Expense id — used by the service worker for the View/Edit action. */
  expenseId?: string
  /** Optional icon override (defaults to /icons/icon-192.png). */
  icon?: string
}

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys are not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.')
  }
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
}

/**
 * Send a push notification to all registered devices for `userId`.
 * Uses the service-role Supabase client so RLS doesn't block the subscription lookup.
 */
export async function sendWebPush(
  userId: string,
  supabase: SupabaseClient,
  payload: WebPushPayload,
): Promise<void> {
  ensureVapid()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error || !subs?.length) return

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: '/icons/icon-32.png',
    smsEventId: payload.smsEventId,
    expenseId: payload.expenseId,
  })

  const staleIds: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification,
          { TTL: 300 }, // 5 minutes — matches undo window
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          // Subscription expired / unsubscribed on device.
          staleIds.push(sub.id)
        } else {
          console.warn('[push/send] delivery error', sub.endpoint.slice(-20), err)
        }
      }
    }),
  )

  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }
}
