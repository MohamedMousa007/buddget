'use client'

import { isAndroid, isNative } from '@/lib/native/isNative'
import { apiUrl } from '@/lib/apiBase'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

let listenerAttached = false
let listenerHandle: { remove: () => Promise<void> } | null = null

interface SmsCapacitorPlugin {
  checkPermission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  /** Persists token to SharedPreferences so SmsReceiver can use WorkManager when the app is killed. */
  saveToken(opts: { token: string; apiUrl: string }): Promise<void>
  addListener(
    event: 'onSmsReceive',
    handler: (data: { message?: string; sender?: string }) => void,
  ): { remove: () => Promise<void> }
}

// Module-level cache — registerPlugin() is called exactly once.
// IMPORTANT: Never return the Capacitor plugin proxy from an async function.
// JS Promise resolution calls .then() on any returned object to check if it
// is a thenable. Capacitor proxies forward .then() to native as a method call,
// causing "SmsCapacitorPlugin.then() is not implemented on android" and
// silently aborting the entire permission flow.
let _plugin: SmsCapacitorPlugin | null = null
let _pluginLoaded = false

async function ensurePlugin(): Promise<boolean> {
  if (_pluginLoaded) return _plugin !== null
  _pluginLoaded = true
  if (!isNative() || !isAndroid()) return false
  try {
    const { registerPlugin } = await import('@capacitor/core')
    // Store in module var — never return the proxy itself from an async function.
    _plugin = registerPlugin<SmsCapacitorPlugin>('SmsCapacitorPlugin')
    return true
  } catch {
    return false
  }
}

export async function checkSmsPermission(): Promise<boolean> {
  if (!(await ensurePlugin())) return false
  try {
    const { granted } = await _plugin!.checkPermission()
    return granted
  } catch {
    return false
  }
}

export async function requestSmsPermission(): Promise<boolean> {
  if (!(await ensurePlugin())) return false
  try {
    const { granted } = await _plugin!.requestPermission()
    return granted
  } catch {
    return false
  }
}

export async function startSMSTracking(accessToken: string): Promise<void> {
  if (!isNative() || !isAndroid()) return
  if (listenerAttached) return

  if (!(await ensurePlugin()) || !_plugin) {
    console.warn('[sms-tracker] SmsCapacitorPlugin not available')
    return
  }

  const granted = await checkSmsPermission()
  if (!granted) {
    console.warn('[sms-tracker] SMS permission not granted')
    return
  }

  // Persist token to SharedPreferences so SmsReceiver's WorkManager path works
  // even when the app is completely killed by Android's memory manager.
  try {
    const { apiUrl: buildUrl } = await import('@/lib/apiBase')
    const base = buildUrl('').replace(/\/$/, '')
    await _plugin!.saveToken({ token: accessToken, apiUrl: base })
  } catch {
    // Non-fatal — JS listener path still works while the app is open.
  }

  listenerAttached = true
  listenerHandle = _plugin.addListener('onSmsReceive', (payload) => {
    const text = payload?.message?.trim()
    if (!text) return
    // Read keywords from store snapshot at arrival time — instantly reflects Settings changes.
    const customKeywords = useFinanceStore.getState().settings.customSmsKeywords ?? []
    if (!isBankishMessage(text, customKeywords)) return
    void forwardToParser(text, payload?.sender, accessToken)
  })
}

export async function stopSMSTracking(): Promise<void> {
  listenerAttached = false
  if (listenerHandle) {
    try { await listenerHandle.remove() } catch { /* noop */ }
    listenerHandle = null
  }
}

/**
 * Refreshes the access token stored in SharedPreferences without
 * re-registering the JS listener. Called on Supabase TOKEN_REFRESHED events
 * so the WorkManager path stays valid after the 1-hour JWT expiry.
 */
export async function refreshSmsToken(accessToken: string): Promise<void> {
  if (!isNative() || !isAndroid()) return
  if (!(await ensurePlugin()) || !_plugin) return
  try {
    const { apiUrl: buildUrl } = await import('@/lib/apiBase')
    const base = buildUrl('').replace(/\/$/, '')
    await _plugin!.saveToken({ token: accessToken, apiUrl: base })
  } catch { /* non-fatal */ }
}

async function forwardToParser(message: string, sender: string | undefined, accessToken: string) {
  try {
    await fetch(apiUrl('/api/sms/parse'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message,
        sender: sender ?? null,
        source: 'sms',
        receivedAt: new Date().toISOString(),
      }),
    })
  } catch (e) {
    console.warn('[sms-tracker] forward failed', e)
  }
}

/**
 * Quick-pass keyword filter to avoid posting personal SMS to the parser.
 * Egypt-first vocabulary merged with user-defined custom keywords.
 */
function isBankishMessage(text: string, customKeywords: string[]): boolean {
  const t = text.toLowerCase()
  const builtIn =
    /(egp|جنيه|تم\s*خصم|تم\s*سحب|تم\s*دفع|عملية\s*شراء|aed|sar|qar|kwd|omr|bhd)/i.test(text) ||
    t.includes('debited') ||
    t.includes('spent at') ||
    t.includes('purchase of') ||
    t.includes('transaction of') ||
    t.includes('withdrawn')
  if (builtIn) return true
  return customKeywords.some((kw) => kw.trim() && t.includes(kw.trim().toLowerCase()))
}
