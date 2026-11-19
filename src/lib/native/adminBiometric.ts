'use client'

import { authenticate, isAvailable } from '@/lib/native/biometricAuth'
import { isNative } from '@/lib/native/isNative'
import { readSecureItem, removeSecureItem, writeSecureItem } from '@/lib/native/secureItem'

/** Where builds before the secure store kept the secret; migrated on first read. */
const LEGACY_KEY = 'buddget.admin.biometric.secret'
const KEY = 'admin_biometric_secret'

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
  return !!(await readSecureItem(KEY, LEGACY_KEY))
}

/** Mints a device secret and returns the hash to register server-side; the secret itself never leaves the device. */
export async function prepareAdminBiometric(): Promise<{ secretHash: string; commit: () => Promise<void> }> {
  await authenticate('Enable biometric unlock for the admin portal')
  const secret = randomSecret()
  return {
    secretHash: await sha256Hex(secret),
    commit: async () => {
      if (!(await writeSecureItem(KEY, LEGACY_KEY, secret))) throw new Error('Secure storage unavailable')
    },
  }
}

/** Prompts for biometrics and returns the stored secret, or null if this device was never enrolled. */
export async function readAdminSecretWithBiometric(): Promise<string | null> {
  await authenticate('Unlock the buddget admin portal')
  return readSecureItem(KEY, LEGACY_KEY)
}

export async function clearLocalAdminSecret(): Promise<void> {
  await removeSecureItem(KEY, LEGACY_KEY)
}
