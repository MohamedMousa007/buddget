import { describe, expect, it } from 'vitest'
import { FlowChipItem, type FlowChip } from './FlowChipRow'

const chip = (over: Partial<FlowChip> = {}): FlowChip => ({ key: 'b-food', label: 'Food', selected: false, onPress: () => {}, icon: null, ...over })
const same = (a: FlowChip, b: FlowChip) => (FlowChipItem as unknown as { compare: (x: unknown, y: unknown) => boolean }).compare({ chip: a }, { chip: b })

describe('FlowChipItem memo (QA-84)', () => {
  it('treats a rebuilt but equal chip as unchanged', () => {
    expect(same(chip(), chip())).toBe(true)
    expect(same(chip({ budget: { kind: 'budgeted', pct: 0.4 } }), chip({ budget: { kind: 'budgeted', pct: 0.4 } }))).toBe(true)
  })
  it('redraws when what the chip shows changes', () => {
    expect(same(chip(), chip({ selected: true }))).toBe(false)
    expect(same(chip(), chip({ label: 'Fuel' }))).toBe(false)
    expect(same(chip({ budget: { kind: 'budgeted', pct: 0.4 } }), chip({ budget: { kind: 'budgeted', pct: 0.5 } }))).toBe(false)
    expect(same(chip({ budget: { kind: 'unassigned' } }), chip())).toBe(false)
  })
})
