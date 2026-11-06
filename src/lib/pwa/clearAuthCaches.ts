/** Service-worker caches that can hold one user's pages or data (next-pwa names). Static assets are left alone. */
export const AUTH_SCOPED_CACHES = ['apis', 'others', 'start-url', 'next-data'] as const

/** Sign-out: the next person on this browser must not be served the previous user's cached responses. */
export async function clearAuthCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  await Promise.all(AUTH_SCOPED_CACHES.map((name) => caches.delete(name).catch(() => false)))
}
