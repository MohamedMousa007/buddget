'use client'

import { isAndroid, isNative } from '@/lib/native/isNative'
import { apiUrl } from '@/lib/apiBase'

let listenerAttached = false

interface SmsRetrieverPlugin {
  startWatch(): Promise<{ message?: string }>
  removeAllListeners(): Promise<void>
  addListener(
    event: 'onSmsReceived',
    handler: (data: { message: string; sender?: string }) => void,
  ): { remove: () => Promise<void> }
}

/**
 * Starts the Android SMS retriever. Only active on native Android — no-op
 * elsewhere (web/iOS handle SMS via the iOS Shortcuts bridge instead).
 *
 * Egypt-first behavior:
 *  - Bank SMS keywords are scanned EGP / جنيه / تم خصم / debited / spent first,
 *    then UAE / AED, then GCC.
 *  - Forwards every retrieved message to `/api/sms/parse` with the user's JWT.
 */
export async function startSMSTracking(accessToken: string): Promise<void> {
  if (!isNative() || !isAndroid()) return
  if (listenerAttached) return
  listenerAttached = true

  try {
    const mod = (await import('capacitor-sms-retriever')) as unknown as {
      SmsRetriever?: SmsRetrieverPlugin
      default?: SmsRetrieverPlugin
    }
    const plugin = mod.SmsRetriever ?? mod.default
    if (!plugin) {
      console.warn('[sms-tracker] plugin missing — Android only')
      listenerAttached = false
      return
    }

    plugin.addListener('onSmsReceived', (payload) => {
      const text = payload?.message?.trim()
      if (!text) return
      void forwardToParser(text, payload?.sender, accessToken)
    })

    await plugin.startWatch()
  } catch (e) {
    console.warn('[sms-tracker] startWatch failed (likely missing Android permission)', e)
    listenerAttached = false
  }
}

async function forwardToParser(message: string, sender: string | undefined, accessToken: string) {
  if (!isBankishMessage(message)) return
  try {
    await fetch(apiUrl('/api/sms/parse'), {
      method: 'POST',
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
 * Egypt-first vocabulary, then UAE, then GCC.
 */
function isBankishMessage(text: string): boolean {
  const t = text.toLowerCase()
  return (
    /(egp|جنيه|تم\s*خصم|تم\s*سحب|تم\s*دفع|عملية\s*شراء|aed|sar|qar|kwd|omr|bhd)/i.test(text) ||
    t.includes('debited') ||
    t.includes('spent at') ||
    t.includes('purchase of') ||
    t.includes('transaction of') ||
    t.includes('withdrawn')
  )
}

export async function stopSMSTracking(): Promise<void> {
  if (!isNative() || !isAndroid()) return
  try {
    const mod = (await import('capacitor-sms-retriever')) as unknown as {
      SmsRetriever?: SmsRetrieverPlugin
      default?: SmsRetrieverPlugin
    }
    const plugin = mod.SmsRetriever ?? mod.default
    await plugin?.removeAllListeners()
    listenerAttached = false
  } catch {
    /* noop */
  }
}
