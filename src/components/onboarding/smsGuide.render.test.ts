import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SmsTrackingGuide, { STEPS } from './SmsTrackingGuide'
import { ShortcutsScene } from './sms/ShortcutsScenes'

describe('SMS guide renders', () => {
  it('every scene renders and names the thing to tap', () => {
    const labels: Record<string, string> = { automationTab: 'Automation', pickMessage: 'Message', messageContains: 'Message Contains', runImmediately: 'Run Immediately', searchAction: 'Catch Bank SMS', shortcutInput: 'Shortcut Input' }
    for (const s of STEPS) if (s.scene) expect(renderToStaticMarkup(h(ShortcutsScene, { id: s.scene }))).toContain(labels[s.scene])
  })
  it('opens on the intro with the setup call to action and no old red/hex colours', () => {
    const html = renderToStaticMarkup(h(SmsTrackingGuide, {}))
    expect(html).toContain('Set up auto-tracking')
    expect(html).not.toMatch(/#[0-9a-f]{6}/i)
  })
})
