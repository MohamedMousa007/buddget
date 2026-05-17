/**
 * VAPID key constants for Web Push.
 *
 * VAPID_PUBLIC_KEY is safe to expose to the browser (it's part of the spec).
 * VAPID_PRIVATE_KEY must remain server-side only (never export from this module to
 * client components — the client only needs the public key).
 *
 * Generate a keypair once with:
 *   npx web-push generate-vapid-keys
 * and add the output to your .env.local / Vercel environment variables.
 */

/** The VAPID public key sent to the browser when subscribing. Safe to expose. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

/** Server-only — used by the `web-push` npm package to sign push requests. */
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''

/** Contact info sent to push services (mailto: or https: URL). */
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:hello@buddget.app'
