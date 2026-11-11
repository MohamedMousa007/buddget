/* Buddget service worker (hand-written, no build step). Offline page + static assets; never caches /api/. */
const VERSION = 'v1'
const STATIC = `static-${VERSION}`
const PAGES = `pages-${VERSION}`
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE_URL)).catch(() => {}))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Authenticated responses must never be replayed to the next person on a shared browser.
  if (url.pathname.startsWith('/api/')) return

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) cache.put(request, res.clone())
        return res
      }),
    )
    return
  }

  // Pages: network first, last good copy when offline, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(request, res.clone()))
          return res
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error()),
    )
  }
})

// ── Push event ────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}

  const title = data.title ?? 'Buddget'
  const options = {
    body: data.body,
    icon: data.icon ?? '/icons/icon-192.png',
    badge: data.badge ?? '/icons/icon-32.png',
    data: {
      parseLogId: data.parseLogId,
      expenseId: data.expenseId,
    },
    actions: [
      { action: 'undo', title: 'Undo' },
      { action: 'view', title: 'View' },
    ],
    tag: data.parseLogId ? `sms-${data.parseLogId}` : 'buddget',
    renotify: true,
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event
  const notifData = notification.data
  const parseLogId = notifData?.parseLogId
  const expenseId = notifData?.expenseId

  notification.close()

  if (action === 'undo' && parseLogId) {
    event.waitUntil(
      fetch('/api/sms/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parseLogId }),
        credentials: 'include',
      }).catch((err) => {
        console.warn('[sw] undo fetch failed', err)
      }),
    )
    return
  }

  const targetUrl =
    action === 'view' && expenseId ? '/flow' : '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
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
