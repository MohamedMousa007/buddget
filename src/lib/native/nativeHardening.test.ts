import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(p, 'utf8')
const A = 'android/app/src/main/java/app/buddget'

describe('Android SMS bridge hardening (static)', () => {
  it('NAT-1: the forward worker supplies a foreground notification and the manifest declares the service type', () => {
    const worker = read(`${A}/SmsForwardWorker.kt`)
    expect(worker).toContain('override suspend fun getForegroundInfo(): ForegroundInfo')
    expect(worker).toContain('NotificationChannel(CHANNEL_ID')
    expect(worker).toContain('FOREGROUND_SERVICE_TYPE_DATA_SYNC')
    const manifest = read('android/app/src/main/AndroidManifest.xml')
    expect(manifest).toMatch(/SystemForegroundService"\s+android:foregroundServiceType="dataSync"/)
    expect(manifest).toContain('android.permission.FOREGROUND_SERVICE_DATA_SYNC')
    expect(manifest).toContain('android.permission.FOREGROUND_SERVICE"')
  })

  it('SST-2: saveToken and the worker both refuse a URL outside the allow-list; iOS does too', () => {
    expect(read(`${A}/SmsCapacitorPlugin.kt`)).toMatch(/SmsApiUrl\.isAllowed\(apiUrl[\s\S]*?call\.reject/)
    expect(read(`${A}/SmsForwardWorker.kt`)).toContain('SmsApiUrl.isAllowed(apiUrl')
    const ios = read('ios/App/App/SmsCapacitorPlugin.swift')
    expect(ios).toContain('guard SmsApiUrl.isAllowed(apiUrl)')
    expect(ios).toMatch(/static var apiUrl: String\? \{[^\n]*SmsApiUrl\.isAllowed/)
    expect(read(`${A}/SmsApiUrl.kt`)).toContain('private const val HOST = "buddget.app"')
    expect(ios).toContain('private static let host = "buddget.app"')
  })

  it('SST-2: the native allow-list host is the one capacitor.config allows the WebView to reach', () => {
    expect(read('capacitor.config.ts')).toContain("allowNavigation: ['buddget.app', '*.buddget.app']")
  })

  it('NAT-3: both plugins keep the device secret next to the SMS token, and clearState leaves it alone', () => {
    const kt = read(`${A}/SmsCapacitorPlugin.kt`)
    expect(kt).toContain('putString("device_secret"')
    const clearState = kt.slice(kt.indexOf('fun clearState'))
    expect(clearState).not.toContain('device_secret')
    const swift = read('ios/App/App/SmsCapacitorPlugin.swift')
    expect(swift).toContain('SmsKeychain.write("device_secret"')
    expect(swift.slice(swift.indexOf('static func clear()'))).not.toContain('device_secret')
  })
})

describe('NAT-2: explicit sign-out disarms SMS forwarding', () => {
  it('AuthProvider.signOut clears the stored ingest token and owner, not the whole device state', () => {
    const auth = read('src/components/auth/AuthProvider.tsx')
    const signOut = auth.slice(auth.indexOf('const signOut = useCallback'), auth.indexOf('const unlock = useCallback'))
    expect(signOut).toContain('clearSmsCredentials()')
    expect(signOut).not.toContain('clearSmsNative()\n')
  })
  it('both native clearCredentials drop the token, API URL and owner and disarm', () => {
    const kt = read(`${A}/SmsCapacitorPlugin.kt`)
    const credentials = kt.slice(kt.indexOf('fun clearCredentials'), kt.indexOf('fun setDeviceSecret'))
    for (const k of ['access_token', 'api_url', 'token_user_id']) expect(credentials).toContain(`.remove("${k}")`)
    expect(credentials).toContain('putBoolean("sms_enabled", false)')
    expect(credentials).not.toContain('pending_queue')
    const swift = read('ios/App/App/SmsCapacitorPlugin.swift')
    const clearCreds = swift.slice(swift.indexOf('static func clearCredentials()'), swift.indexOf('static func clear()'))
    expect(clearCreds).toContain('SmsKeychain.delete(tokenAccount)')
    expect(clearCreds).toContain('d.set(false, forKey: enabledKey)')
    expect(clearCreds).not.toContain('queueAccount')
  })
})
