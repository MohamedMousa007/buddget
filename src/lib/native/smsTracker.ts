'use client'

import { isNative } from '@/lib/native/isNative'

export interface SmsBridgeStatus {
  tokenSaved: boolean
  enabled: boolean
  /** iOS: Shortcut setup guide finished. Android: == tokenSaved (no guide). */
  setupCompleted: boolean
  /**
   * The device capability: a Shortcut (iOS) / receiver (Android) physically
   * exists here. True once setup finished, the bridge ever fired, or a token is
   * stored. DEVICE truth — survives account switches; only a fresh install
   * clears it. Gates whether Settings shows the switch vs. the setup CTA.
   */
  wired: boolean
  /** Which account the stored ingest token belongs to ('' if none). */
  tokenUserId?: string
  /** Android: live RECEIVE_SMS permission. iOS: always true (no OS SMS perm). */
  permission: boolean
  lastRunAt?: string
  lastResult?: string
  /** SMS captured but not yet delivered to the server (offline / bad token). */
  pendingCount?: number
}

export interface PendingSmsItem {
  message: string
  sender: string
  receivedAt: string
  source: string
  /** Account that owned the bridge when this SMS was captured ('' / absent = legacy). */
  userId?: string
}

export interface SmsHealthResult {
  ok: boolean
  status: number
  tokenSaved: boolean
}

export interface SmsCapacitorPlugin {
  checkPermission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  /** Persists token + owning user natively (SharedPreferences / UserDefaults) so the killed-app forwarding path stays armed and account-attributed. */
  saveToken(opts: { token: string; apiUrl: string; userId: string }): Promise<void>
  /** Gates native forwarding — Android SmsReceiver / iOS CatchBankSmsIntent. */
  setEnabled(opts: { enabled: boolean }): Promise<void>
  /** iOS: marks the Shortcut setup guide as finished (gates switch visibility). */
  setSetupCompleted(opts: { completed: boolean }): Promise<void>
  /** Android forwarding mode: "sender" (Phase 1) or "keyword" (legacy/Phase 2). iOS no-op. */
  setForwardMode(opts: { mode: string }): Promise<void>
  /** Account switch: drop the stored ingest token/owner + disarm, KEEPING the device
   *  capability (setupCompleted/lastRunAt/queue) so the switch never regresses to the CTA. */
  clearCredentials(): Promise<void>
  /** Full device wipe (fresh install / forget device): also clears setupCompleted + queue. */
  clearState(): Promise<void>
  /** Per-device bridge state — authoritative for the UI. */
  getStatus(): Promise<SmsBridgeStatus>
  /** iOS only: GET /api/sms/health through the same native path the intent uses. */
  healthCheck(): Promise<SmsHealthResult>
  /** Returns queued SMS WITHOUT clearing — the queue stays authoritative. */
  peekPendingQueue(): Promise<{ items: PendingSmsItem[] }>
  /** Removes items after the server confirmed them (or permanently rejected). */
  removePending(opts: { items: PendingSmsItem[] }): Promise<void>
}

/** Fired whenever the native pending queue may have changed (post-drain). */
export const SMS_QUEUE_CHANGED_EVENT = 'buddget:sms-queue-changed'

/** Fired when a native plugin call fails or recovers; read the message with getSmsNativeError(). */
export const SMS_NATIVE_ERROR_EVENT = 'buddget:sms-native-error'

/** Drain attempts after which a 400 that is not an explicit invalid-payload rejection is dropped. */
export const MAX_DRAIN_ATTEMPTS = 5

let _nativeError: string | null = null

/** Last native plugin failure ("op: message"), cleared by the next successful call. Null = native is in sync. */
export function getSmsNativeError(): string | null {
  return _nativeError
}

function setNativeError(next: string | null): void {
  if (next === _nativeError) return
  _nativeError = next
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SMS_NATIVE_ERROR_EVENT))
}

async function callNative<T>(op: string, call: (plugin: SmsCapacitorPlugin) => Promise<T>, fallback: T): Promise<T> {
  if (!(await ensurePlugin()) || !_plugin) return fallback
  try {
    const result = await call(_plugin)
    setNativeError(null)
    return result
  } catch (e) {
    setNativeError(`${op}: ${e instanceof Error ? e.message : String(e)}`)
    return fallback
  }
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
  if (!isNative()) return false
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
  return callNative('checkPermission', async (p) => (await p.checkPermission()).granted, false)
}

export async function requestSmsPermission(): Promise<boolean> {
  return callNative('requestPermission', async (p) => (await p.requestPermission()).granted, false)
}

/**
 * Fetches the permanent sms_ingest_token from the server and persists it
 * natively via saveSmsToken. The JWT is used ONLY as the Authorization header
 * for this fetch — it is NEVER written to native storage (a stored JWT expires
 * in ~1h and every later SMS POST would 401 and be dropped). Retries because a
 * failed fetch must leave the previously-stored ingest token untouched: it
 * never expires, so stale-but-valid beats clobbered.
 */
export async function ensureIngestToken(accessToken: string, userId: string): Promise<boolean> {
  if (!isNative() || !accessToken || !userId) return false
  const { apiFetchAuth } = await import('@/lib/apiBase')
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // apiFetchAuth carries the device-id header, so the server can scope the
      // ingest token to THIS device (per-device rotation/revocation). The explicit
      // Authorization wins over the session lookup inside buildAuthHeaders.
      const res = await apiFetchAuth('/api/sms/setup-token', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = (await res.json()) as { token?: string }
        if (data.token) {
          await saveSmsToken(data.token, userId)
          return true
        }
      }
      if (res.status === 401) return false // bad session — retrying won't help
    } catch { /* network error — retry below */ }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
  return false
}

export async function stopSMSTracking(): Promise<void> {
  // Fully pause the native receiver — no notifications, no WorkManager.
  await callNative('setEnabled', (p) => p.setEnabled({ enabled: false }), undefined)
}

/**
 * Saves the permanent sms_ingest_token (non-expiring) natively — Android
 * SharedPreferences for SmsForwardWorker, iOS UserDefaults for
 * CatchBankSmsIntent — so the killed-app path always has a valid credential.
 * Called from useSmsTracking whenever the ingest token is fetched or rotated.
 * resolveUserId in /api/sms/parse accepts this token as Bearer.
 */
export async function saveSmsToken(ingestToken: string, userId: string): Promise<void> {
  const { apiUrl: buildUrl } = await import('@/lib/apiBase')
  const base = buildUrl('').replace(/\/$/, '')
  await callNative('saveToken', (p) => p.saveToken({ token: ingestToken, apiUrl: base, userId }), undefined)
}

/**
 * Account switch guard: if the natively-stored ingest token belongs to a
 * different user than the one now signed in, drop it (and disarm) BEFORE any
 * SMS can be forwarded with the wrong account's credentials. Keeps the device
 * capability (setupCompleted/lastRunAt) intact — the Shortcut/receiver still
 * physically exists; only the account binding is wrong. Called on SIGNED_IN.
 */
export async function reconcileSmsOwner(userId: string): Promise<void> {
  if (!isNative() || !userId) return
  const status = await getSmsBridgeStatus()
  // Clear whenever a token is stored whose owner is NOT the current user — this
  // includes legacy tokens saved before owner-stamping existed (tokenUserId ''),
  // which have unknown ownership and must be re-established for this account
  // rather than trusted. Same-user tokens are kept (no needless re-arm).
  if (status?.tokenSaved && status.tokenUserId !== userId) {
    await clearSmsCredentials()
  }
}

/** Account switch: drop the stored token/owner + disarm, keep the device capability. */
export async function clearSmsCredentials(): Promise<void> {
  await callNative('clearCredentials', (p) => p.clearCredentials(), undefined)
}

/** Gates native forwarding without touching the stored token. */
export async function setSmsEnabled(enabled: boolean): Promise<void> {
  await callNative('setEnabled', (p) => p.setEnabled({ enabled }), undefined)
}

/** iOS: mark the Shortcut setup guide finished so the on/off switch becomes visible. */
export async function setIosSetupCompleted(completed: boolean): Promise<void> {
  await callNative('setSetupCompleted', (p) => p.setSetupCompleted({ completed }), undefined)
}

/** Switch the Android forwarding mode ("sender" Phase 1 / "keyword" Phase 2). */
export async function setSmsForwardMode(mode: 'sender' | 'keyword'): Promise<void> {
  await callNative('setForwardMode', (p) => p.setForwardMode({ mode }), undefined)
}

/** Full device wipe (forget this device): clears token, queue, setupCompleted, enabled. */
export async function clearSmsNative(): Promise<void> {
  await callNative('clearState', (p) => p.clearState(), undefined)
}

const attempts = new Map<string, number>()
const itemKey = (i: PendingSmsItem) => `${i.receivedAt}|${i.sender}|${i.message}`

/**
 * 422 and a zod "Invalid body" 400 mean the payload itself can never succeed. Any other 400
 * (e.g. "Invalid JSON" from a mangled body) may be transient or fixable, so it is retried up to
 * MAX_DRAIN_ATTEMPTS drains before the item is dropped.
 */
async function isPermanentRejection(res: Response, item: PendingSmsItem): Promise<boolean> {
  if (res.status === 422) return true
  if (res.status !== 400) return false
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  if (body?.error === 'Invalid body') return true
  const key = itemKey(item)
  const n = (attempts.get(key) ?? 0) + 1
  attempts.set(key, n)
  return n >= MAX_DRAIN_ATTEMPTS
}

/**
 * Replays the native pending queue (SMS captured offline / undeliverable) to
 * /api/sms/parse SEQUENTIALLY. The queue stays authoritative the whole time:
 * items are only removed AFTER the server confirmed (2xx) or permanently
 * rejected (422 / invalid-body 400, or a persistent 400 after MAX_DRAIN_ATTEMPTS) them, so an app kill mid-replay never loses an SMS.
 * Auth (401/403), rate-limit (429), 5xx and network errors leave the item
 * queued for the next drain. The server dedups by sms_hash, so re-delivering
 * an item whose removal didn't land is harmless.
 */
export async function drainAndSubmitPendingSms(accessToken: string, userId: string): Promise<void> {
  if (!isNative() || !accessToken || !userId) return
  const peeked = await callNative<PendingSmsItem[] | null>('peekPendingQueue', async (p) => (await p.peekPendingQueue()).items ?? [], null)
  if (!peeked) return
  let items = peeked
  // Only replay SMS captured under the CURRENT account. Items owned by a previous
  // account (item.userId set and different) stay queued for when that user returns
  // — draining them now would file them under the wrong account (the server
  // resolves the user from this session's JWT, not the item). Legacy items (no
  // owner stamp) deliver to the current user, matching pre-owner-stamp behavior.
  items = items.filter((i) => !i.userId || i.userId === userId)
  if (items.length === 0) return

  const { apiUrl: buildUrl } = await import('@/lib/apiBase')
  const done: PendingSmsItem[] = []
  for (const item of items) {
    try {
      const res = await fetch(buildUrl('/api/sms/parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(item),
      })
      if (res.ok || (await isPermanentRejection(res, item))) {
        done.push(item)
        attempts.delete(itemKey(item))
      } else if (res.status === 401 || res.status === 403) {
        break // token problem — every remaining item would fail identically
      }
      // 429/5xx: leave queued, keep trying the rest (per-item quota may differ)
    } catch {
      break // network dropped mid-drain — stop, everything left stays queued
    }
  }
  if (done.length > 0) {
    await callNative('removePending', (p) => p.removePending({ items: done }), undefined)
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SMS_QUEUE_CHANGED_EVENT))
}

/** Non-destructive read of the pending queue for the waiting-to-sync cards. */
export async function peekPendingSms(): Promise<PendingSmsItem[]> {
  if (!isNative()) return []
  return callNative('peekPendingQueue', async (p) => (await p.peekPendingQueue()).items ?? [], [])
}

/** Per-device bridge status — token saved, enabled, setup completed, permission. */
export async function getSmsBridgeStatus(): Promise<SmsBridgeStatus | null> {
  return callNative<SmsBridgeStatus | null>('getStatus', (p) => p.getStatus(), null)
}

/** One-tap setup check: validates the stored ingest token against /api/sms/health
 *  through the same native URLSession path CatchBankSmsIntent uses. */
export async function runSmsHealthCheck(): Promise<SmsHealthResult | null> {
  return callNative<SmsHealthResult | null>('healthCheck', (p) => p.healthCheck(), null)
}
