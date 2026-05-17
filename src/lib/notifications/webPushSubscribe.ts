/**
 * Client-side Web Push subscription helper.
 *
 * Call `subscribeToPush()` after the user grants notification permission.
 * It registers with the browser's push manager using our VAPID public key,
 * then POSTs the resulting subscription to `/api/push/subscribe` for storage.
 *
 * Call `unsubscribeFromPush()` when the user disables SMS tracking to clean up.
 */

import { VAPID_PUBLIC_KEY } from '@/lib/notifications/vapid'

/** Converts a base64url VAPID public key to a Uint8Array for pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

/**
 * Subscribe the current browser to Web Push and persist the subscription in Supabase.
 * Returns `true` on success, `false` if the browser doesn't support push or the
 * user denied notification permission.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
    return false
  }

  const registration = await navigator.serviceWorker.ready

  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    // Already subscribed — make sure it's persisted on the server.
    await persistSubscription(existing)
    return true
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })

  await persistSubscription(subscription)
  return true
}

async function persistSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.['p256dh'] ?? '',
      auth: json.keys?.['auth'] ?? '',
      userAgent: navigator.userAgent,
    }),
  })
}

/**
 * Unsubscribe from Web Push and remove the subscription from Supabase.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await fetch('/api/push/unsubscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })

  await subscription.unsubscribe()
}
