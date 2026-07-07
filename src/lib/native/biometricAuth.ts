'use client'

import { isNative } from '@/lib/native/isNative'
import { Preferences } from '@capacitor/preferences'

const SESSION_KEY = 'buddget.biometric.session'
const ENABLED_KEY = 'buddget.biometric.enabled'
const ACCOUNT_KEY = 'buddget.biometric.account'
const SECRET_KEY = 'buddget.biometric.secret'
const APPLOCK_KEY = 'buddget.biometric.applock'

export type BiometryType = 'face' | 'fingerprint' | 'iris' | 'unknown' | null

interface AvailableInfo {
  available: boolean
  type: BiometryType
}

interface BiometryPlugin {
  checkBiometry(): Promise<{
    isAvailable: boolean
    biometryType?: number
    biometryTypes?: number[]
    reason?: string
    code?: string
  }>
  authenticate(opts: {
    reason?: string
    cancelTitle?: string
    fallbackTitle?: string
    androidTitle?: string
    androidSubtitle?: string
    androidConfirmationRequired?: boolean
    androidBiometryStrength?: 'weak' | 'strong'
  }): Promise<void>
}

// Wrapped in an object: resolving a bare Capacitor plugin proxy from an async
// function makes the promise machinery probe `.then` on the proxy, which the
// proxy forwards as a native call → unhandled "BiometricAuthNative.then() is
// not implemented" rejection on every load.
async function loadPlugin(): Promise<{ plugin: BiometryPlugin } | null> {
  if (!isNative()) return null
  try {
    const mod = (await import('@aparajita/capacitor-biometric-auth')) as unknown as {
      BiometricAuth?: BiometryPlugin
      default?: BiometryPlugin
    }
    const plugin = mod.BiometricAuth ?? mod.default ?? null
    return plugin ? { plugin } : null
  } catch (e) {
    console.warn('[biometric] plugin missing', e)
    return null
  }
}

/** Maps the plugin's numeric biometry type to a readable label. */
function biometryTypeFrom(num: number | undefined): BiometryType {
  if (!num) return null
  // @aparajita/capacitor-biometric-auth enum:
  // 1=touchId(iOS), 2=faceId(iOS), 3=fingerprintAuthentication(Android), 4=faceAuthentication(Android), 5=irisAuthentication
  if (num === 1 || num === 3) return 'fingerprint'
  if (num === 2 || num === 4) return 'face'
  if (num === 5) return 'iris'
  return 'unknown'
}

/**
 * True when the device supports biometrics AND the user has enrolled. Falls
 * back to WebAuthn detection on web (used to optionally show the icon, but the
 * web path is still less reliable than the native plugin).
 */
export async function isAvailable(): Promise<AvailableInfo> {
  const loaded = await loadPlugin()
  if (loaded) {
    try {
      const info = await loaded.plugin.checkBiometry()
      // Diagnostic: on iOS a device that "shows nothing" reports why here
      // (isAvailable/biometryType/code) — read via Safari Web Inspector.
      console.warn('[biometric] checkBiometry', JSON.stringify(info))
      const type = biometryTypeFrom(info.biometryType ?? info.biometryTypes?.[0])
      return { available: Boolean(info.isAvailable), type }
    } catch (e) {
      console.warn('[biometric] checkBiometry failed', e)
      return { available: false, type: null }
    }
  }

  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const supported = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
      return { available: Boolean(supported), type: 'unknown' }
    } catch {
      return { available: false, type: null }
    }
  }
  return { available: false, type: null }
}

/** Returns the human-readable biometry kind without forcing a prompt. */
export async function getType(): Promise<BiometryType> {
  return (await isAvailable()).type
}

/**
 * Triggers a biometric prompt. Resolves on success; rejects with a message on
 * cancel / failure. The web fallback uses the WebAuthn `get()` ceremony with
 * userVerification: 'required'.
 */
export async function authenticate(reason = 'Sign in to Buddget'): Promise<void> {
  const loaded = await loadPlugin()
  if (loaded) {
    // Android maps `androidTitle`→setTitle and `reason`→setDescription; setting
    // both to the same string rendered two identical lines. Keep them distinct:
    // brand as the title, `reason` as the single action line. (No androidSubtitle.)
    await loaded.plugin.authenticate({
      reason,
      cancelTitle: 'Cancel',
      fallbackTitle: 'Use passcode',
      androidTitle: 'Buddget',
      androidConfirmationRequired: false,
      androidBiometryStrength: 'weak',
    })
    return
  }

  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw new Error('Biometrics are not available on this device')
  }

  // Best-effort web fallback. Use a fresh per-call challenge (32 bytes random).
  const challenge = new Uint8Array(32)
  window.crypto.getRandomValues(challenge)
  await navigator.credentials.get({
    publicKey: {
      challenge,
      timeout: 30_000,
      userVerification: 'required',
      rpId: window.location.hostname,
    },
  })
}

/** Removes any legacy stashed session token. Biometric no longer stores or
 *  replays tokens — the SDK owns the session and LockScreen just gates it — so
 *  this only cleans up pairs written by older builds. */
export async function clearSession(): Promise<void> {
  try {
    await Preferences.remove({ key: SESSION_KEY })
  } catch {
    /* noop */
  }
}

export async function getLinkedAccount(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: ACCOUNT_KEY })
    return value || null
  } catch {
    return null
  }
}

export async function setEnabled(enabled: boolean, email?: string): Promise<void> {
  try {
    await Preferences.set({ key: ENABLED_KEY, value: enabled ? '1' : '0' })
    if (!enabled) {
      await clearSession()
      await Preferences.remove({ key: ACCOUNT_KEY })
    } else if (email) {
      await Preferences.set({ key: ACCOUNT_KEY, value: email })
    }
  } catch {
    /* noop */
  }
}

export async function isEnabled(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: ENABLED_KEY })
    return value === '1'
  } catch {
    return false
  }
}

/** Opt-in app lock: also require a biometric prompt on every cold launch, not
 *  just for signed-out re-login. Independent of `isEnabled` at the storage level
 *  but only meaningful while biometric sign-in is enabled. */
export async function isAppLockEnabled(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: APPLOCK_KEY })
    return value === '1'
  } catch {
    return false
  }
}

export async function setAppLockEnabled(on: boolean): Promise<void> {
  try {
    await Preferences.set({ key: APPLOCK_KEY, value: on ? '1' : '0' })
  } catch {
    /* noop */
  }
}

// ---- Device-token sign-in ---------------------------------------------------
// A 256-bit device secret is minted on enable and stored on-device; only its
// SHA-256 hash is registered server-side. Biometric sign-in exchanges the secret
// for a fresh session (verifyOtp) — no Supabase token is ever stored or replayed.

function randomSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Enable biometric sign-in for the signed-in account on this device. Mints a
 * device secret, registers its hash with the backend (which takes over any prior
 * binding on this device), then persists the secret + enabled state locally.
 * Must be called while authenticated. Returns false on any failure.
 */
export async function registerBiometric(email?: string): Promise<boolean> {
  try {
    const secret = randomSecret()
    const secretHash = await sha256Hex(secret)
    const { apiFetchAuth } = await import('@/lib/apiBase')
    const res = await apiFetchAuth('/api/biometric/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret_hash: secretHash }),
    })
    if (!res.ok) return false
    await Preferences.set({ key: SECRET_KEY, value: secret })
    await setEnabled(true, email)
    return true
  } catch (e) {
    console.warn('[biometric] registerBiometric failed', e)
    return false
  }
}

/** Disable biometric sign-in: drop the server binding and wipe local secret/state. */
export async function unregisterBiometric(): Promise<void> {
  try {
    const { apiFetchAuth } = await import('@/lib/apiBase')
    await apiFetchAuth('/api/biometric/register', { method: 'DELETE' })
  } catch (e) {
    console.warn('[biometric] unregisterBiometric request failed', e)
  }
  try { await Preferences.remove({ key: SECRET_KEY }) } catch { /* noop */ }
  await setAppLockEnabled(false)
  await setEnabled(false)
}

/**
 * Signed-out biometric sign-in. Prompts, then exchanges the stored device secret
 * for a fresh session via the backend + verifyOtp. Throws only on prompt
 * cancel/dismiss (message contains "cancel"); returns false on any auth failure.
 */
export async function biometricSignIn(reason?: string): Promise<boolean> {
  await authenticate(reason)
  const { value: secret } = await Preferences.get({ key: SECRET_KEY })
  if (!secret) return false
  const { apiFetchAuth } = await import('@/lib/apiBase')
  const res = await apiFetchAuth('/api/biometric/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret }),
  })
  if (!res.ok) return false
  const data = (await res.json().catch(() => null)) as { email?: string; token?: string } | null
  if (!data?.email || !data.token) return false
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  // The OTP comes from generateLink({type:'magiclink'}). GoTrue accepts it under
  // either 'email' or 'magiclink' depending on version — try the common one, then
  // fall back so a version mismatch can't silently break sign-in.
  const first = await supabase.auth.verifyOtp({ email: data.email, token: data.token, type: 'email' })
  if (!first.error) return true
  const second = await supabase.auth.verifyOtp({ email: data.email, token: data.token, type: 'magiclink' })
  return !second.error
}
