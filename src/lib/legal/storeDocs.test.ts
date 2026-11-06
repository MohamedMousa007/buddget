import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../../..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const perms = (s: string) => [...new Set([...s.matchAll(/android\.permission\.[A-Z_]+/g)].map((m) => m[0]))].sort()

describe('ADS-8 Play submission doc matches the app', () => {
  const play = read('docs/GOOGLE_PLAY_SUBMISSION.md')
  const manifest = read('android/app/src/main/AndroidManifest.xml')

  it('lists exactly the permissions the Android manifest declares', () => {
    const block = play.slice(play.indexOf('## 2.'), play.indexOf('## 3.'))
    const declared = [...manifest.matchAll(/<uses-permission android:name="(android\.permission\.[A-Z_]+)"/g)].map((m) => m[1])
    expect(perms(block)).toEqual([...new Set(declared)].sort())
  })

  it('does not ask for READ_SMS or describe a notification listener the app does not have', () => {
    expect(manifest).not.toContain('READ_SMS')
    expect(manifest).not.toContain('NotificationListener')
    expect(play.replace(/no `READ_SMS`|there is no READ_SMS|never reads the inbox/gi, '')).not.toMatch(/READ_SMS/)
    expect(play).not.toMatch(/BIND_NOTIFICATION_LISTENER/)
  })

  it('declares device identifiers, phone number, analytics and crash data like STORE_PRIVACY.md', () => {
    const section = play.slice(play.indexOf('## 4.'), play.indexOf('## 5.'))
    expect(section).not.toMatch(/Device identifiers \| No/)
    for (const row of ['Phone number', 'User IDs', 'Device or other IDs', 'App interactions', 'Crash logs', 'Messages: SMS', 'Other financial info', 'Photos', 'Voice or sound recordings'])
      expect(section, row).toContain(row)
    expect(section).toContain('docs/STORE_PRIVACY.md')
  })

  it('STORE_PRIVACY.md declares the same data types', () => {
    const store = read('docs/STORE_PRIVACY.md')
    for (const t of ['Phone number', 'Device ID', 'Product interaction', 'Crash data', 'Audio', 'Photos']) expect(store, t).toContain(t)
  })

  it('points to the real policy URLs', () => {
    expect(play).toContain('https://buddget.app/legal/privacy')
    expect(play).toContain('/ar/legal/privacy')
    expect(play).not.toContain('buddget.app/privacy`')
  })
})
