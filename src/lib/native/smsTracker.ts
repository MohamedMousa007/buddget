'use client'

import { isAndroid, isNative } from '@/lib/native/isNative'

export interface SmsBridgeStatus {
  tokenSaved: boolean
  enabled: boolean
  /** iOS: Shortcut setup guide finished. Android: == tokenSaved (no guide). */
  setupCompleted: boolean
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
}

export interface SmsHealthResult {
  ok: boolean
  status: number
  tokenSaved: boolean
}

interface SmsCapacitorPlugin {
  checkPermission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  /** Persists token natively (SharedPreferences / UserDefaults) so the killed-app forwarding path stays armed. */
  saveToken(opts: { token: string; apiUrl: string }): Promise<void>
  /** Gates native forwarding — Android SmsReceiver / iOS CatchBankSmsIntent. */
  setEnabled(opts: { enabled: boolean }): Promise<void>
  /** iOS: marks the Shortcut setup guide as finished (gates switch visibility). */
  setSetupCompleted(opts: { completed: boolean }): Promise<void>
  /** Android forwarding mode: "sender" (Phase 1) or "keyword" (legacy/Phase 2). iOS no-op. */
  setForwardMode(opts: { mode: string }): Promise<void>
  /** Sign-out: wipe per-device SMS state (token/enabled/setupCompleted). */
  clearState(): Promise<void>
  /** Per-device bridge state — authoritative for the UI. */
  getStatus(): Promise<SmsBridgeStatus>
  /** iOS only: GET /api/sms/health through the same native path the intent uses. */
  healthCheck(): Promise<SmsHealthResult>
  /** Returns and clears SMS queued while offline / undeliverable, for replay. */
  drainPendingQueue(): Promise<{ items: PendingSmsItem[] }>
  /** Re-appends items whose replay failed so they survive to the next drain. */
  requeuePending(opts: { items: PendingSmsItem[] }): Promise<void>
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

/**
 * Fetches the permanent sms_ingest_token from the server and persists it
 * natively via saveSmsToken. The JWT is used ONLY as the Authorization header
 * for this fetch — it is NEVER written to native storage (a stored JWT expires
 * in ~1h and every later SMS POST would 401 and be dropped). Retries because a
 * failed fetch must leave the previously-stored ingest token untouched: it
 * never expires, so stale-but-valid beats clobbered.
 */
export async function ensureIngestToken(accessToken: string): Promise<boolean> {
  if (!isNative() || !accessToken) return false
  const { apiUrl: buildUrl } = await import('@/lib/apiBase')
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(buildUrl('/api/sms/setup-token'), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = (await res.json()) as { token?: string }
        if (data.token) {
          await saveSmsToken(data.token)
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
  if (await ensurePlugin()) {
    try { await _plugin!.setEnabled({ enabled: false }) } catch { /* noop */ }
  }
}

/**
 * Saves the permanent sms_ingest_token (non-expiring) natively — Android
 * SharedPreferences for SmsForwardWorker, iOS UserDefaults for
 * CatchBankSmsIntent — so the killed-app path always has a valid credential.
 * Called from useSmsTracking whenever the ingest token is fetched or rotated.
 * resolveUserId in /api/sms/parse accepts this token as Bearer.
 */
export async function saveSmsToken(ingestToken: string): Promise<void> {
  if (!(await ensurePlugin()) || !_plugin) return
  try {
    const { apiUrl: buildUrl } = await import('@/lib/apiBase')
    const base = buildUrl('').replace(/\/$/, '')
    await _plugin.saveToken({ token: ingestToken, apiUrl: base })
  } catch { /* non-fatal */ }
}

/** Gates native forwarding without touching the stored token. */
export async function setSmsEnabled(enabled: boolean): Promise<void> {
  if (!(await ensurePlugin()) || !_plugin) return
  try { await _plugin.setEnabled({ enabled }) } catch { /* noop */ }
}

/** iOS: mark the Shortcut setup guide finished so the on/off switch becomes visible. */
export async function setIosSetupCompleted(completed: boolean): Promise<void> {
  if (!(await ensurePlugin()) || !_plugin) return
  try { await _plugin.setSetupCompleted({ completed }) } catch { /* noop */ }
}

/** Switch the Android forwarding mode ("sender" Phase 1 / "keyword" Phase 2). */
export async function setSmsForwardMode(mode: 'sender' | 'keyword'): Promise<void> {
  if (!(await ensurePlugin()) || !_plugin) return
  try { await _plugin.setForwardMode({ mode }) } catch { /* noop */ }
}

/** Sign-out / account switch: wipe per-device SMS state so the next user starts OFF. */
export async function clearSmsNative(): Promise<void> {
  if (!(await ensurePlugin()) || !_plugin) return
  try { await _plugin.clearState() } catch { /* noop */ }
}

/**
 * Drains the native pending queue (SMS captured offline or undeliverable —
 * iOS: CatchBankSmsIntent failures; Android: SmsForwardWorker failures) and
 * replays each item to /api/sms/parse SEQUENTIALLY, re-queueing anything that
 * still fails so no SMS is ever lost to a flaky replay. The server dedups by
 * sms_hash, so a double-submit (e.g. app killed mid-drain) is harmless.
 */
export async function drainAndSubmitPendingSms(accessToken: string): Promise<void> {
  if (!isNative() || !accessToken) return
  if (!(await ensurePlugin()) || !_plugin) return
  let items: PendingSmsItem[]
  try {
    items = (await _plugin.drainPendingQueue()).items ?? []
  } catch {
    return
  }
  if (items.length === 0) return

  const { apiUrl: buildUrl } = await import('@/lib/apiBase')
  const failed: PendingSmsItem[] = []
  for (const item of items) {
    try {
      const res = await fetch(buildUrl('/api/sms/parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(item),
      })
      // 4xx = the server rejected this item permanently (bad payload) — do not
      // re-queue it forever. 5xx/network = transient, keep it.
      if (res.status >= 500) failed.push(item)
    } catch {
      failed.push(item)
    }
  }
  if (failed.length > 0) {
    try { await _plugin.requeuePending({ items: failed }) } catch { /* next SMS re-arms */ }
  }
}

/** Per-device bridge status — token saved, enabled, setup completed, permission. */
export async function getSmsBridgeStatus(): Promise<SmsBridgeStatus | null> {
  if (!(await ensurePlugin()) || !_plugin) return null
  try {
    return await _plugin.getStatus()
  } catch {
    return null
  }
}

/** One-tap setup check: validates the stored ingest token against /api/sms/health
 *  through the same native URLSession path CatchBankSmsIntent uses. */
export async function runSmsHealthCheck(): Promise<SmsHealthResult | null> {
  if (!(await ensurePlugin()) || !_plugin) return null
  try {
    return await _plugin.healthCheck()
  } catch {
    return null
  }
}
