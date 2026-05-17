/**
 * Custom service worker extension — bundled by next-pwa as a custom worker.
 *
 * next-pwa v5 discovers this file at src/worker/index.ts automatically
 * (customWorkerDir defaults to "worker").
 *
 * This file is compiled with webworker lib types (see tsconfig.json alongside).
 * It is intentionally excluded from the main Next.js tsconfig to avoid lib conflicts.
 */

// ── Push event ────────────────────────────────────────────────────────────────

interface PushPayload {
  title?: string
  body?: string
  icon?: string
  badge?: string
  smsEventId?: string
  expenseId?: string
}

self.addEventListener('push', (event: PushEvent) => {
  const data: PushPayload = event.data?.json() ?? {}

  const title = data.title ?? 'Buddget'
  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon ?? '/icons/icon-192.png',
    badge: data.badge ?? '/icons/icon-32.png',
    data: {
      smsEventId: data.smsEventId,
      expenseId: data.expenseId,
    },
    actions: [
      { action: 'undo', title: 'Undo' },
      { action: 'view', title: 'View' },
    ],
    tag: data.smsEventId ? `sms-${data.smsEventId}` : 'buddget',
    renotify: true,
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  const { action, notification } = event
  const notifData = notification.data as { smsEventId?: string; expenseId?: string } | undefined
  const smsEventId = notifData?.smsEventId
  const expenseId = notifData?.expenseId

  notification.close()

  if (action === 'undo' && smsEventId) {
    event.waitUntil(
      fetch('/api/sms/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsEventId }),
        credentials: 'include',
      }).catch((err: unknown) => {
        console.warn('[sw] undo fetch failed', err)
      }),
    )
    return
  }

  const targetUrl =
    action === 'view' && expenseId ? `/expenses?highlight=${expenseId}` : '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: readonly WindowClient[]) => {
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin) {
            void client.focus()
            if (action === 'view' && expenseId) {
              void client.navigate(targetUrl)
            }
            return
          }
        }
        return self.clients.openWindow(targetUrl)
      }),
  )
})
