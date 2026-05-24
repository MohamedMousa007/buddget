'use client'

/**
 * Android-only fallback for parsing bank notifications when SMS Retriever
 * isn't available (e.g. WhatsApp Pay alerts, banks that send only push).
 *
 * The runtime depends on a tiny custom Capacitor plugin —
 * `@buddget/notification-listener` — that subscribes to
 * `NotificationListenerService` and forwards `(packageName, title, text)`
 * tuples to JS. The plugin source lives in `docs/NOTIFICATION_LISTENER.md`
 * (paste-into-place after `npx cap add android`).
 *
 * Egypt-first whitelist: Egyptian banks → UAE → wider GCC. Some package
 * names below are best-known guesses and need to be confirmed against the
 * publisher in Play Store before shipping.
 */

import { isAndroid, isNative } from '@/lib/native/isNative'
import { apiUrl } from '@/lib/apiBase'

interface NotificationListenerPlugin {
  start(opts: { packages: string[] }): Promise<void>
  stop(): Promise<void>
  isEnabled(): Promise<{ enabled: boolean }>
  openSettings(): Promise<void>
  addListener(
    event: 'onNotificationPosted',
    handler: (data: { packageName: string; title?: string; text?: string }) => void,
  ): { remove: () => Promise<void> }
}

/** Egypt-first bank-app package whitelist. Verify in Play Store before shipping. */
export const BANK_PACKAGE_WHITELIST: string[] = [
  // Egypt (priority — verify exact ids)
  'com.nbe.mobile',
  'com.cib.mobile',
  'com.banquemisr.mobile',
  'com.qnbalahli.mobile',
  'com.aaib.mobile',
  'com.hsbc.eg.mobile',
  'com.faisalislamic.eg',
  'com.boa.mobile', // Bank of Alexandria / Alex Bank
  'com.alexbank.mobile',
  'com.bdc.mobile', // Banque du Caire
  'com.adib.eg.mobile',
  'com.creditagricole.eg',
  'com.fawry.mobile',
  'com.vodafone.cash.eg',
  'com.weraqi.eg',
  // UAE
  'com.adcb.bank',
  'com.emiratesnbd.mobilebanking',
  'com.fab.mobilebanking',
  'com.mashreq.mobilebanking',
  'com.wio.bank',
  'com.revolut.app',
  // Saudi
  'com.alrajhibank.app',
  'com.snb.mobile',
  'com.riyadbank.mobile',
  'com.alinma.mobile',
  // Qatar
  'com.qnb.qatar',
  'com.dohabank.mobile',
  // Kuwait
  'com.nbk.mobile',
  'com.boubyan.mobile',
  // Oman
  'com.bankmuscat.mobile',
  // Bahrain
  'com.bbk.mobile',
  'com.nbb.mobile',
]

let attached = false

async function loadPlugin(): Promise<NotificationListenerPlugin | null> {
  if (!isNative() || !isAndroid()) return null
  try {
    const { registerPlugin } = await import('@capacitor/core')
    return registerPlugin<NotificationListenerPlugin>('NotificationListener')
  } catch {
    return null
  }
}

/**
 * Begins listening for whitelisted bank notifications and forwards each one
 * to `/api/sms/parse` with `source: 'notification'` so de-duplication shares
 * the SMS hash logic.
 */
export async function startNotificationListener(accessToken: string): Promise<void> {
  if (attached) return
  const plugin = await loadPlugin()
  if (!plugin) return

  const status = await plugin.isEnabled().catch(() => ({ enabled: false }))
  if (!status.enabled) {
    await plugin.openSettings().catch(() => {})
    return
  }

  attached = true
  plugin.addListener('onNotificationPosted', (data) => {
    if (!data.packageName) return
    if (!BANK_PACKAGE_WHITELIST.includes(data.packageName)) return
    const message = [data.title, data.text].filter(Boolean).join(' — ').trim()
    if (!message) return
    void forward(message, data.packageName, accessToken)
  })

  await plugin.start({ packages: BANK_PACKAGE_WHITELIST })
}

export async function stopNotificationListener(): Promise<void> {
  const plugin = await loadPlugin()
  if (!plugin) return
  try {
    await plugin.stop()
  } catch {
    /* noop */
  }
  attached = false
}

async function forward(message: string, sender: string, accessToken: string): Promise<void> {
  try {
    await fetch(apiUrl('/api/sms/parse'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message,
        sender,
        source: 'notification',
        receivedAt: new Date().toISOString(),
      }),
    })
  } catch (e) {
    console.warn('[notification-listener] forward failed', e)
  }
}
