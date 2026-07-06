'use client'

import { isNative } from '@/lib/native/isNative'
import { Preferences } from '@capacitor/preferences'

const SESSION_KEY = 'buddget.biometric.session'
const ENABLED_KEY = 'buddget.biometric.enabled'
const ACCOUNT_KEY = 'buddget.biometric.account'
const PENDING_ENABLE_KEY = 'buddget.biometric.pendingEnable'

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
export async function authenticate(reason = 'Unlock Buddget'): Promise<void> {
  const loaded = await loadPlugin()
  if (loaded) {
    await loaded.plugin.authenticate({
      reason,
      cancelTitle: 'Cancel',
      fallbackTitle: 'Use passcode',
      androidTitle: 'Buddget',
      androidSubtitle: reason,
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

/** Returns the saved Supabase session token (set after a previous email sign-in). */
export async function getSavedSession(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: SESSION_KEY })
    return value || null
  } catch {
    return null
  }
}

export async function saveSession(refreshToken: string): Promise<void> {
  try {
    await Preferences.set({ key: SESSION_KEY, value: refreshToken })
  } catch (e) {
    console.warn('[biometric] saveSession failed', e)
  }
}

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

/** One-shot marker: user tapped the biometric button on the auth screen before
 *  enabling it — enable automatically after the next successful sign-in. */
export async function setPendingEnable(): Promise<void> {
  try {
    await Preferences.set({ key: PENDING_ENABLE_KEY, value: '1' })
  } catch {
    /* noop */
  }
}

export async function consumePendingEnable(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: PENDING_ENABLE_KEY })
    if (value !== '1') return false
    await Preferences.remove({ key: PENDING_ENABLE_KEY })
    return true
  } catch {
    return false
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
