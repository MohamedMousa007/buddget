import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/components/features/ai-chat/QuotaWheel', () => ({ QuotaWheel: () => null }))
import { AIChatComposer } from './AIChatComposer'

const base = { value: '', onChange: () => {}, onSend: () => {}, onStop: () => {}, busy: false, usageKey: 'k' }
const html = (mic?: Parameters<typeof AIChatComposer>[0]['mic'], busy = false) => renderToStaticMarkup(createElement(AIChatComposer, { ...base, busy, mic }))

describe('AIChatComposer mic', () => {
  it('has no mic where voice is not offered', () => {
    expect(html()).not.toContain('Record a voice message')
  })
  it('offers a labelled mic next to send, and a stop control while recording', () => {
    const idle = html({ state: 'idle', error: null, onStart: () => {}, onStop: () => {} })
    expect(idle).toContain('aria-label="Record a voice message"')
    expect(idle).toContain('aria-label="Send"')
    expect(html({ state: 'recording', error: null, onStart: () => {}, onStop: () => {} })).toContain('aria-label="Stop and send"')
  })
  it('shows the sending line while transcribing, disables the mic, and shows an error line', () => {
    const t = html({ state: 'transcribing', error: null, onStart: () => {}, onStop: () => {} })
    expect(t).toContain('Turning your voice into text')
    expect(t).toMatch(/disabled[^>]*aria-label="Record a voice message"|aria-label="Record a voice message"[^>]*disabled/)
    expect(html({ state: 'idle', error: 'Couldn’t access the microphone.', onStart: () => {}, onStop: () => {} })).toContain('role="alert"')
  })
  it('the mic is disabled while a reply is being written', () => {
    expect(html({ state: 'idle', error: null, onStart: () => {}, onStop: () => {} }, true)).toMatch(/disabled/)
  })
})
