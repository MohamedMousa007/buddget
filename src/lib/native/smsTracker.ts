'use client'

import { isAndroid, isNative } from '@/lib/native/isNative'
import { apiUrl } from '@/lib/apiBase'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

let listenerAttached = false
let listenerHandle: { remove: () => Promise<void> } | null = null

interface SmsCapacitorPlugin {
  checkPermission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  addListener(
    event: 'onSmsReceive',
    handler: (data: { message?: string; sender?: string }) => void,
  ): { remove: () => Promise<void> }
}

async function loadPlugin(): Promise<SmsCapacitorPlugin | null> {
  if (!isNative() || !isAndroid()) return null
  try {
    const { registerPlugin } = await import('@capacitor/core')
    return registerPlugin<SmsCapacitorPlugin>('SmsCapacitorPlugin')
  } catch {
    return null
  }
}

export async function checkSmsPermission(): Promise<boolean> {
  const plugin = await loadPlugin()
  if (!plugin) return false
  try {
    const { granted } = await plugin.checkPermission()
    return granted
  } catch {
    return false
  }
}

export async function requestSmsPermission(): Promise<boolean> {
  const plugin = await loadPlugin()
  if (!plugin) return false
  try {
    const { granted } = await plugin.requestPermission()
    return granted
  } catch {
    return false
  }
}

export async function startSMSTracking(accessToken: string): Promise<void> {
  if (!isNative() || !isAndroid()) return
  if (listenerAttached) return

  const plugin = await loadPlugin()
  if (!plugin) {
    console.warn('[sms-tracker] SmsCapacitorPlugin not available')
    return
  }

  const granted = await checkSmsPermission()
  if (!granted) {
    console.warn('[sms-tracker] SMS permission not granted')
    return
  }

  listenerAttached = true
  listenerHandle = plugin.addListener('onSmsReceive', (payload) => {
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
    try {
      await listenerHandle.remove()
    } catch {
      /* noop */
    }
    listenerHandle = null
  }
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
