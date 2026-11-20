import { describe, expect, it } from 'vitest'
import { computePanel, keyboardOpen } from './panelGeometry'

// BDG-014: the chat panel must sit inside what the user can see, above the keyboard, so the composer is never covered.
const notch = { top: 47, bottom: 34, left: 0, right: 0 }
const orb = { side: 'right' as const, top: 600 }

describe('keyboardOpen', () => {
  it('reads iOS from a visual viewport shorter than the layout one', () => {
    expect(keyboardOpen(844, 508, 0, false)).toBe(true)
    expect(keyboardOpen(844, 840, 0, false)).toBe(false)
  })
  it('reads Android, where both viewports shrink, from a focused text field', () => {
    expect(keyboardOpen(508, 508, 0, true)).toBe(true)
  })
})

describe('computePanel', () => {
  it('without the keyboard keeps the tab bar and header clear, as before', () => {
    const p = computePanel(orb, { width: 390, height: 844, offsetTop: 0, keyboard: false }, notch)
    expect(p.top).toBeGreaterThanOrEqual(47 + 52 + 12)
    expect(p.top + p.height).toBeLessThanOrEqual(844 - 34 - 76)
  })

  it('with the iOS keyboard up the whole panel, composer included, sits above the keyboard', () => {
    const p = computePanel(orb, { width: 390, height: 508, offsetTop: 0, keyboard: true }, notch)
    expect(p.top).toBeGreaterThanOrEqual(47)
    expect(p.top + p.height).toBeLessThanOrEqual(508)
    expect(p.height).toBeGreaterThan(400)
  })

  it('follows a visual viewport that iOS has panned down', () => {
    const p = computePanel(orb, { width: 390, height: 508, offsetTop: 200, keyboard: true }, notch)
    expect(p.top).toBeGreaterThanOrEqual(200)
    expect(p.top + p.height).toBeLessThanOrEqual(200 + 508)
  })

  it('on Android (window already shrunk) stops reserving the tab bar and home indicator', () => {
    const up = computePanel(orb, { width: 390, height: 508, offsetTop: 0, keyboard: true }, notch)
    const down = computePanel(orb, { width: 390, height: 508, offsetTop: 0, keyboard: false }, notch)
    expect(up.height).toBeGreaterThan(down.height)
  })

  it('leaves the desktop panel alone', () => {
    const a = computePanel(orb, { width: 1280, height: 800, offsetTop: 0, keyboard: true }, notch)
    const b = computePanel(orb, { width: 1280, height: 800, offsetTop: 0, keyboard: false }, notch)
    expect(a).toEqual(b)
  })
})
