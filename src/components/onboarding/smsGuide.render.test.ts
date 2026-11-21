import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/components/ui/dialog/DialogProvider', () => ({ useConfirm: () => async () => true }))
import SmsTrackingGuide, { DoneScene, STEPS } from './SmsTrackingGuide'
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
  it('offers "Shortcuts already exist? Skip guide" on the intro (BDG-008)', () => {
    expect(renderToStaticMarkup(h(SmsTrackingGuide, {}))).toContain('Shortcuts already exist? Skip guide')
  })
  it('the close button sits inside the header row, not over the status bar (BDG-008b)', () => {
    const html = renderToStaticMarkup(h(SmsTrackingGuide, {}))
    expect(html).not.toContain('absolute end-4 top-4')
    expect(html).toMatch(/<div class="flex items-center gap-2\.5">(?:(?!<\/div>).)*aria-label="Close"/)
  })
  it('the done screen says "Not confirmed yet" until an SMS from this phone reached the server, never "Automation active"', () => {
    const unverified = renderToStaticMarkup(h(DoneScene, { verified: false }))
    expect(unverified).toContain('Not confirmed yet')
    expect(unverified).not.toContain('Automation active')
    expect(renderToStaticMarkup(h(DoneScene, { verified: true }))).not.toContain('Not confirmed yet')
  })
})
