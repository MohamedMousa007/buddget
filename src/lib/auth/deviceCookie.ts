import { cookies } from 'next/headers'

export const DEVICE_COOKIE_NAME = 'buddget_device_id'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180 // 180 days

/** Read the HttpOnly device-id cookie if present. */
export async function readDeviceCookie(): Promise<string | null> {
  const c = await cookies()
  const v = c.get(DEVICE_COOKIE_NAME)?.value
  return v && /^[0-9a-f-]{10,}$/i.test(v) ? v : null
}

/** Mint + set a fresh device-id cookie; returns the new id. */
export async function setDeviceCookie(id: string): Promise<void> {
  const c = await cookies()
  c.set(DEVICE_COOKIE_NAME, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}
