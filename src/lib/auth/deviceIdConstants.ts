/** Sent by the Capacitor shell on cross-origin API calls (cookies are not shared). */
export const DEVICE_ID_HEADER = 'X-Buddget-Device-Id'

/** The server-issued secret that proves a trusted device is the one that was trusted (native; web uses an HttpOnly cookie). */
export const DEVICE_SECRET_HEADER = 'X-Buddget-Device-Secret'

/** What a device id looks like: the same shape the cookie path enforces, capped so a client cannot mint unbounded rate-limit keys. */
export const DEVICE_ID_PATTERN = /^[0-9a-f-]{10,64}$/i
