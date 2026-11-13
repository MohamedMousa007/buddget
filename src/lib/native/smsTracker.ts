'use client'

import { isNative } from '@/lib/native/isNative'
import { withNativeFlow } from '@/lib/native/appLockPolicy'
import { isAllowedSmsApiUrl } from '@/lib/native/smsApiUrl'
import { isDue, loadRetryState, nextDelayMs, retryAfterMs, saveRetryState } from '@/lib/native/smsRetryState'

export interface SmsBridgeStatus {
  tokenSaved: boolean
  /** Android: the secure store was recreated empty; re-save the ingest token on next open. */
  needsResync?: boolean
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
  /** Messages the native queue cap evicted since the last time the app acknowledged them. */
  evictedCount?: number
  /** receivedAt of the oldest still-queued SMS (backlog age); absent when the queue is empty. */
  oldestPendingAt?: string
}

export interface PendingSmsItem {
  message: string
  sender: string
  receivedAt: string
  source: string
  /** Account that owned the bridge when this SMS was captured ('' / absent = legacy). */
  userId?: string
  /** Generated once natively per received SMS and persisted with it; sent as `eventId` + `x-sms-event-id`. */
  eventId?: string
  /** Set natively when the body was already cut to MAX_SMS_CHARS. */
  truncated?: boolean
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
  /** Trusted-device secret in the same secure store as the ingest token (Keychain / EncryptedSharedPreferences). Survives clearCredentials and clearState. */
  setDeviceSecret(opts: { secret: string }): Promise<void>
  getDeviceSecret(): Promise<{ secret: string | null }>
  removeDeviceSecret(): Promise<void>
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

/** Longest SMS body the server accepts; longer bodies are cut client-side and flagged `truncated`. */
export const MAX_SMS_CHARS = 2000

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
  return callNative('requestPermission', (p) => withNativeFlow(async () => (await p.requestPermission()).granted), false)
}

/**
 * Explicit sign-out: retires this phone's server-side ingest token so the non-expiring token left in native storage stops
 * working (NAT-2). Best-effort and idempotent; the next sign-in re-arms through `ensureIngestToken`.
 */
export async function revokeIngestToken(accessToken: string): Promise<void> {
  if (!isNative() || !accessToken) return
  try {
    const { apiFetchAuth } = await import('@/lib/apiBase')
    await apiFetchAuth('/api/sms/revoke-token', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
  } catch (e) {
    console.error('[sms] token revoke failed', e)
  }
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
  // The native plugins refuse the same URLs; failing here keeps a misconfigured build visible in the native-error banner.
  if (!isAllowedSmsApiUrl(`${base}/`)) { setNativeError('saveToken: SMS API base URL is not allowed'); return }
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

/** Secure-store access for the trusted-device secret. False / null when the native store is unavailable. */
export async function setSecureDeviceSecret(secret: string): Promise<boolean> {
  return callNative('setDeviceSecret', async (p) => { await p.setDeviceSecret({ secret }); return true }, false)
}

export async function getSecureDeviceSecret(): Promise<string | null> {
  return callNative('getDeviceSecret', async (p) => (await p.getDeviceSecret()).secret ?? null, null)
}

export async function removeSecureDeviceSecret(): Promise<boolean> {
  return callNative('removeDeviceSecret', async (p) => { await p.removeDeviceSecret(); return true }, false)
}

/** Full device wipe (forget this device): clears token, queue, setupCompleted, enabled. */
export async function clearSmsNative(): Promise<void> {
  await callNative('clearState', (p) => p.clearState(), undefined)
}

const itemKey = (i: PendingSmsItem) => i.eventId ?? `${i.receivedAt}|${i.sender}|${i.message.length}`

/** Server answered "another delivery of this SMS is being claimed right now": retry later, never delete. */
async function isClaimInProgress(res: Response): Promise<boolean> {
  if (res.status === 202) return true
  if (res.status !== 409) return false
  const body = (await res.json().catch(() => null)) as { retry?: boolean } | null
  return body?.retry === true
}

/** Body as sent to the server: oversized messages are cut and flagged instead of being rejected forever. */
export function buildSmsPayload(item: PendingSmsItem): PendingSmsItem {
  if (item.message.length <= MAX_SMS_CHARS) return item
  return { ...item, message: item.message.slice(0, MAX_SMS_CHARS), truncated: true }
}

let draining: Promise<void> | null = null
let lastForceAt = 0
let lastOutcome: string | null = null

/** How the last delivery attempt ended (`delivered`, `http_403`, `network`...), reported to staff with the queue size. */
export function getLastDrainOutcome(): string | null {
  return lastOutcome
}

/** A tap on a waiting message may run at most this often. */
const FORCE_COOLDOWN_MS = 5_000

/**
 * Replays the native pending queue (SMS captured offline / undeliverable) to /api/sms/parse SEQUENTIALLY.
 * The queue stays authoritative: an item is removed ONLY after the server accepted it (2xx). A refusal of any kind
 * (400/422, auth, rate limit, 5xx, network) leaves it queued on a jittered backoff schedule (see smsRetryState), so a
 * message the server keeps refusing is parked and visible to staff, never deleted. A failure that would hit every
 * remaining item the same way (network, auth, rate limit, 5xx) stops the run. `force` (the user tapped the message)
 * ignores the schedule. Concurrent calls share one run.
 */
export function drainAndSubmitPendingSms(accessToken: string, userId: string, opts: { force?: boolean } = {}): Promise<void> {
  if (draining) return draining
  if (opts.force) {
    if (Date.now() - lastForceAt < FORCE_COOLDOWN_MS) return Promise.resolve()
    lastForceAt = Date.now()
  }
  draining = runDrain(accessToken, userId, opts.force === true).finally(() => { draining = null })
  return draining
}

/** Tapped "Captured offline": retry every waiting message now, whatever the schedule says. */
export async function retrySmsNow(): Promise<void> {
  const { createClient } = await import('@/lib/supabase/client')
  const { data } = await createClient().auth.getSession()
  const token = data.session?.access_token
  const uid = data.session?.user?.id
  if (token && uid) await drainAndSubmitPendingSms(token, uid, { force: true })
}

/** 4xx that belongs to this one message (not the session, the clock or the rate limit): the rest of the queue may still go. */
const isMessageSpecific = (status: number) => status >= 400 && status < 500 && ![401, 403, 408, 429].includes(status)

async function runDrain(accessToken: string, userId: string, force: boolean): Promise<void> {
  if (!isNative() || !accessToken || !userId) return
  const peeked = await callNative<PendingSmsItem[] | null>('peekPendingQueue', async (p) => (await p.peekPendingQueue()).items ?? [], null)
  if (!peeked) return
  // Only replay SMS captured under the CURRENT account. Items owned by a previous
  // account (item.userId set and different) stay queued for when that user returns.
  // Legacy items (no owner stamp) deliver to the current user.
  const items = peeked.filter((i) => !i.userId || i.userId === userId)
  if (items.length === 0) return

  const { apiUrl: buildUrl } = await import('@/lib/apiBase')
  const { deviceIdHeader } = await import('@/lib/native/deviceId')
  const deviceHeaders = await deviceIdHeader()
  const state = loadRetryState()
  const done: PendingSmsItem[] = []
  const park = (key: string, lastError: string, delay: { poison?: boolean; retryAfterMs?: number } = {}) => {
    const attempts = (state[key]?.attempts ?? 0) + 1
    state[key] = { attempts, nextAt: Date.now() + nextDelayMs(attempts, delay), lastError }
    lastOutcome = lastError
  }
  for (const item of items) {
    const key = itemKey(item)
    if (!force && !isDue(state[key])) continue
    try {
      // The eventId travels in the body. A custom request header would force a CORS preflight, and one the server does
      // not list makes the browser refuse the request before it leaves the phone: every drain then failed silently.
      const res = await fetch(buildUrl('/api/sms/parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...deviceHeaders },
        body: JSON.stringify(buildSmsPayload(item)),
      })
      if (await isClaimInProgress(res)) { park(key, 'claim_in_progress'); continue }
      if (res.ok) {
        done.push(item)
        delete state[key]
        lastOutcome = 'delivered'
        continue
      }
      const poison = isMessageSpecific(res.status)
      park(key, `http_${res.status}`, { poison, retryAfterMs: retryAfterMs(res.headers.get('Retry-After')) })
      if (!poison) break
    } catch {
      park(key, 'network')
      break // the rest would fail the same way; they stay queued
    }
  }
  if (done.length > 0) {
    await callNative('removePending', (p) => p.removePending({ items: done }), undefined)
  }
  const doneKeys = new Set(done.map(itemKey))
  saveRetryState(state, new Set(peeked.map(itemKey).filter((k) => !doneKeys.has(k))))
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
