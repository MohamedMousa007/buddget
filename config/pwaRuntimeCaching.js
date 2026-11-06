/**
 * Service-worker runtime caching for next-pwa: its defaults minus the `apis` rule, with every /api/ GET going to the
 * network only. That rule stored any 200 under /api/ (admin JSON, notifications, entitlements) for 24 h and replayed it
 * when the network was slow or offline, so the next person on a shared browser could be served the previous user's data.
 */
// next-pwa ships CommonJS and next.config loads this file with require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const defaults = require('next-pwa/cache')

const apiNetworkOnly = {
  urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
  handler: 'NetworkOnly',
  options: { cacheName: 'api-network-only' },
}

module.exports = [apiNetworkOnly, ...defaults.filter((rule) => rule.options.cacheName !== 'apis')]
