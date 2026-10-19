'use client'

import { Preferences } from '@capacitor/preferences'
import { authenticate, isAvailable } from '@/lib/native/biometricAuth'
import { isNative } from '@/lib/native/isNative'

const SECRET_KEY = 'buddget.admin.biometric.secret'

function randomSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Biometric unlock is offered on the native apps, where the OS biometric prompt is reliable. */
export async function adminBiometricSupported(): Promise<boolean> {
  if (!isNative()) return false
  return (await isAvailable()).available
}

export async function hasLocalAdminSecret(): Promise<boolean> {
  try {
    return !!(await Preferences.get({ key: SECRET_KEY })).value
  } catch {
    return false
  }
}

/** Mints a device secret and returns the hash to register server-side; the secret itself never leaves the device. */
export async function prepareAdminBiometric(): Promise<{ secretHash: string; commit: () => Promise<void> }> {
  await authenticate('Enable biometric unlock for the admin portal')
  const secret = randomSecret()
  return {
    secretHash: await sha256Hex(secret),
    commit: () => Preferences.set({ key: SECRET_KEY, value: secret }),
  }
}

/** Prompts for biometrics and returns the stored secret, or null if this device was never enrolled. */
export async function readAdminSecretWithBiometric(): Promise<string | null> {
  await authenticate('Unlock the Buddget admin portal')
  const { value } = await Preferences.get({ key: SECRET_KEY })
  return value || null
}

export async function clearLocalAdminSecret(): Promise<void> {
  try {
    await Preferences.remove({ key: SECRET_KEY })
  } catch {
    /* nothing stored */
  }
}
