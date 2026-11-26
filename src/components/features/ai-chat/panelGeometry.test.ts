import { describe, expect, it, vi } from 'vitest'
import { ORB_INSET, ORB_SIZE, clampOrbTop, computePanel, dragLeft, keyboardOpen, pressGate, snapSide } from './panelGeometry'

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

// BDG-018: the orb follows the finger on both axes and springs to the nearer edge, with a dead zone in the middle.
describe('orb drag', () => {
  it('springs to the nearer edge', () => {
    expect(snapSide(60, 390, 'right')).toBe('left')
    expect(snapSide(330, 390, 'left')).toBe('right')
  })
  it('keeps its side when let go near the middle', () => {
    expect(snapSide(195 + 20, 390, 'left')).toBe('left')
    expect(snapSide(195 - 20, 390, 'right')).toBe('right')
  })
  it('never leaves the screen while it follows the finger', () => {
    expect(dragLeft(-50, 390)).toBe(ORB_INSET)
    expect(dragLeft(900, 390)).toBe(390 - ORB_SIZE - ORB_INSET)
    expect(dragLeft(195, 390)).toBe(195 - ORB_SIZE / 2)
  })
})

// Journey G: Send was pressed with the text field focused; focus left the field, the panel dropped its keyboard layout
// (64px shorter at 390x844) before the release, and the click never reached Send.
describe('pressGate', () => {
  it('a focus change during a press waits for the release, then lays out once', () => {
    const apply = vi.fn()
    const gate = pressGate(apply)
    gate.press()
    gate.focusChanged()
    gate.focusChanged()
    expect(apply).not.toHaveBeenCalled()
    gate.release()
    expect(apply).toHaveBeenCalledTimes(1)
    gate.release()
    expect(apply).toHaveBeenCalledTimes(1)
  })
  it('a focus change with nothing pressed (typing, Tab, the keyboard) lays out at once', () => {
    const apply = vi.fn()
    const gate = pressGate(apply)
    gate.focusChanged()
    expect(apply).toHaveBeenCalledTimes(1)
    gate.press()
    gate.release()
    expect(apply).toHaveBeenCalledTimes(1)
  })
})

describe('clampOrbTop', () => {
  const phone = { top: 47, bottom: 34 }
  it('keeps the orb above the tab bar and the home indicator on phone', () => {
    const top = clampOrbTop(10_000, 852, 393, phone)
    // 64px tab bar + 12px gap + 34px home indicator below the 56px orb.
    expect(top + ORB_SIZE).toBe(852 - 76 - 34)
  })
  it('keeps the orb below the header and the notch', () => {
    expect(clampOrbTop(0, 852, 393, phone)).toBe(47 + 52 + 12)
  })
  it('on desktop clears the QuickAdd FAB instead of a tab bar', () => {
    expect(clampOrbTop(10_000, 900, 1280, { top: 0, bottom: 0 }) + ORB_SIZE).toBe(900 - 96)
    expect(clampOrbTop(0, 900, 1280, { top: 0, bottom: 0 })).toBe(70)
  })
  it('leaves a position that is already clear alone', () => {
    expect(clampOrbTop(400, 852, 393, phone)).toBe(400)
  })
})
