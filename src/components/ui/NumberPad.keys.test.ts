import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { padKeyFor } from './NumberPad'

const key = (k: string, extra: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey'>> & { tag?: string } = {}) =>
  ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...extra, target: extra.tag ? ({ tagName: extra.tag, isContentEditable: false } as unknown as EventTarget) : null })

describe('NumberPad hardware keyboard (W2)', () => {
  it('maps digits, the decimal point, Backspace and Enter to pad keys', () => {
    expect(padKeyFor(key('7'))).toBe('7')
    expect(padKeyFor(key('.'))).toBe('.')
    expect(padKeyFor(key(','))).toBe('.')
    expect(padKeyFor(key('Backspace'))).toBe('back')
    expect(padKeyFor(key('Enter'))).toBe('done')
  })
  it('ignores other keys, modifier chords, and typing inside a real field', () => {
    expect(padKeyFor(key('a'))).toBeNull()
    expect(padKeyFor(key('Escape'))).toBeNull()
    expect(padKeyFor(key('5', { metaKey: true }))).toBeNull()
    expect(padKeyFor(key('5', { tag: 'INPUT' }))).toBeNull()
    expect(padKeyFor(key('5', { tag: 'BUTTON' }))).toBe('5')
  })
})

describe('Escape on the NumberPad (W2)', () => {
  let pushEscapeLayer: (fn: () => void) => () => void
  const removers: Array<() => void> = []
  beforeAll(async () => {
    vi.stubGlobal('window', new EventTarget())
    ;({ pushEscapeLayer } = await import('@/hooks/useEscapeClose'))
  })
  afterEach(() => { while (removers.length) removers.pop()!() })
  const escape = () => window.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }))

  it('closes only the pad, opened after the sheet, and the sheet on the next press', () => {
    const sheet = vi.fn()
    const pad = vi.fn()
    removers.push(pushEscapeLayer(sheet))
    const removePad = pushEscapeLayer(pad)
    escape()
    expect(pad).toHaveBeenCalledTimes(1)
    expect(sheet).not.toHaveBeenCalled()
    removePad()
    escape()
    expect(sheet).toHaveBeenCalledTimes(1)
  })

  it('the pad joins that stack instead of a window listener of its own', () => {
    const src = readFileSync(join(__dirname, 'NumberPad.tsx'), 'utf8')
    expect(src).toContain('useEscapeClose(true, close)')
    expect(src).not.toMatch(/addEventListener\('keydown', onKey, true\)/)
  })
})
