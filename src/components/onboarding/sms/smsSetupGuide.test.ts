import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'
import { IOS26_STEPS, IOS26_STOPS, IOS27_STOPS, IOS27_WALKTHROUGH } from './guideStops'
import { SHARED_SHORTCUT_URL, SmsSetupGuide } from './SmsSetupGuide'

const ALL = { ...IOS27_STOPS, ...IOS26_STOPS }

describe('SMS setup guide data', () => {
  it('every stop image ships in public/ and every target sits inside its capture', () => {
    for (const [id, s] of Object.entries(ALL)) {
      expect(existsSync(join(process.cwd(), 'public', s.src)), `${id}: ${s.src}`).toBe(true)
      for (const v of [s.x, s.y, s.tipY]) expect(v, id).toBeGreaterThanOrEqual(0)
      for (const v of [s.x, s.y, s.tipY]) expect(v, id).toBeLessThanOrEqual(100)
      expect(s.zoom, id).toBeGreaterThanOrEqual(1)
    }
  })
  it('every stop has a tip in English and Arabic, and the manual steps match their copy', () => {
    for (const id of Object.keys(ALL)) {
      expect(en.smsSetup.tips[id], `en ${id}`).toBeTruthy()
      expect(ar.smsSetup.tips[id], `ar ${id}`).toBeTruthy()
    }
    expect(en.smsSetup.steps).toHaveLength(IOS26_STEPS.length)
    expect(ar.smsSetup.steps).toHaveLength(IOS26_STEPS.length)
    expect(IOS27_WALKTHROUGH[0]).toBe('addShortcut')
  })
  it('the shared shortcut is the full iCloud link', () => {
    expect(SHARED_SHORTCUT_URL).toMatch(/^https:\/\/www\.icloud\.com\/shortcuts\/[0-9a-f]{32}$/)
  })
})

describe('SMS setup guide renders', () => {
  it('iOS 27 opens on the branded screen with one button, "See how it works"', () => {
    const html = renderToStaticMarkup(h(SmsSetupGuide, { variant: 'shortcut' }))
    expect(html).toContain('Every bank SMS,')
    expect(html).toContain('See how it works')
    expect(html).not.toContain('I already know the steps')
    expect(html).toContain('z-[var(--z-dialog)]')
    expect(html).not.toMatch(/#[0-9a-f]{6}/i)
  })
  it('"Add shortcut" from Settings opens straight at the walkthrough with the pings tip', () => {
    const html = renderToStaticMarkup(h(SmsSetupGuide, { variant: 'shortcut', start: 'walkthrough' }))
    expect(html).toContain('Add it, then flip one switch')
    expect(html).toContain('Then stop the pings:')
    expect(html).toContain('/guides/sms/ios27/01-add-shortcut.webp')
    expect(html).toContain('Add shortcut')
  })
  it('older iOS opens on the branded screen with "Start setup" and the skip link', () => {
    const html = renderToStaticMarkup(h(SmsSetupGuide, { variant: 'manual', start: 'walkthrough' }))
    expect(html).toContain('Start setup')
    expect(html).toContain('I already know the steps')
    expect(html).not.toMatch(/#[0-9a-f]{6}/i)
  })
})
