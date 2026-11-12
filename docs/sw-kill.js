/* Service-worker kill switch. If public/sw.js ever misbehaves: copy this file over public/sw.js and deploy.
   Every browser that loads the site replaces the worker, which clears all caches, unregisters itself and reloads open tabs. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url))),
  )
})
