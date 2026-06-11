'use client'

import { isAndroid, isNative } from '@/lib/native/isNative'

export interface SmsBridgeStatus {
  tokenSaved: boolean
  enabled: boolean
  lastRunAt: string
  lastResult: string
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
  /** iOS only: bridge state incl. the App Intent's last run. */
  getStatus(): Promise<SmsBridgeStatus>
  /** iOS only: GET /api/sms/health through the same native path the intent uses. */
  healthCheck(): Promise<SmsHealthResult>
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
 * Arms the native capture path: persists the token to SharedPreferences and
 * enables SmsReceiver. The native WorkManager is the SINGLE forwarding path
 * to /api/sms/parse — there is no JS listener, so a given SMS produces
 * exactly one POST whether the app is open or killed. Live dashboard updates
 * arrive via SmsRealtimeSync (Supabase realtime).
 */
export async function startSMSTracking(accessToken: string): Promise<void> {
  if (!isNative() || !isAndroid()) return

  if (!(await ensurePlugin()) || !_plugin) {
    console.warn('[sms-tracker] SmsCapacitorPlugin not available')
    return
  }

  const granted = await checkSmsPermission()
  if (!granted) {
    console.warn('[sms-tracker] SMS permission not granted')
    return
  }

  try {
    const { apiUrl: buildUrl } = await import('@/lib/apiBase')
    const base = buildUrl('').replace(/\/$/, '')
    await _plugin.saveToken({ token: accessToken, apiUrl: base })
    await _plugin.setEnabled({ enabled: true })
  } catch {
    // Non-fatal — next app open retries via SmsStartupSync.
  }
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

/**
 * Refreshes the access token stored in SharedPreferences. Called on Supabase
 * TOKEN_REFRESHED events so the WorkManager path stays valid after the
 * 1-hour JWT expiry.
 */
export async function refreshSmsToken(accessToken: string): Promise<void> {
  if (!isNative() || !isAndroid()) return
  if (!(await ensurePlugin()) || !_plugin) return
  try {
    const { apiUrl: buildUrl } = await import('@/lib/apiBase')
    const base = buildUrl('').replace(/\/$/, '')
    await _plugin.saveToken({ token: accessToken, apiUrl: base })
  } catch { /* non-fatal */ }
}

/** Gates native forwarding without touching the stored token (iOS toggle path). */
export async function setSmsEnabled(enabled: boolean): Promise<void> {
  if (!(await ensurePlugin()) || !_plugin) return
  try { await _plugin.setEnabled({ enabled }) } catch { /* noop */ }
}

/** iOS bridge status — token saved, enabled, and the App Intent's last run. */
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
