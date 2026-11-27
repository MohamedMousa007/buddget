import { describe, expect, it } from 'vitest'
import { placeMenu } from './CardActionMenu'

const anchor = (top: number, left: number, size = 44) => ({ top, bottom: top + size, left, right: left + size })
const base = { viewportW: 390, viewportH: 844 }

describe('placeMenu', () => {
  it('LTR with room below: under the trigger, right-aligned to it (unchanged)', () => {
    expect(placeMenu({ ...base, anchor: anchor(100, 300), height: 132 })).toEqual({ top: 150, left: 128 })
  })
  it('clamps to the viewport edges', () => {
    expect(placeMenu({ ...base, anchor: anchor(100, 0), height: 88 }).left).toBe(8)
    expect(placeMenu({ ...base, anchor: anchor(100, 380), height: 88, rtl: true }).left).toBe(390 - 216 - 8)
  })
  it("RTL aligns to the trigger's left edge", () => {
    expect(placeMenu({ ...base, anchor: anchor(100, 20), height: 88, rtl: true }).left).toBe(20)
  })
  it('flips above the trigger near the bottom', () => {
    expect(placeMenu({ ...base, anchor: anchor(760, 300), height: 132 })).toEqual({ top: 760 - 6 - 132, left: 128 })
  })
  it('keeps clear of the home indicator', () => {
    expect(placeMenu({ ...base, anchor: anchor(640, 300), height: 132 }).top).toBe(690)
    expect(placeMenu({ ...base, anchor: anchor(640, 300), height: 132, insetBottom: 34 }).top).toBe(640 - 6 - 132)
  })
  it('pins to the bottom edge when neither side has room', () => {
    expect(placeMenu({ ...base, viewportH: 300, anchor: anchor(100, 300), height: 280 }).top).toBe(300 - 8 - 280)
  })
})
