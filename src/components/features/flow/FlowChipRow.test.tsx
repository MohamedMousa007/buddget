// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/i18n', () => ({ useT: () => ({ flow: { removeFilter: (l: string) => `Remove ${l}`, showOnly: (l: string) => `Show ${l}` } }) }))

import { FlowChipItem, type FlowChip } from './FlowChipRow'

let renders = 0
const Probe = () => { renders += 1; return <i /> }
const chip = (over: Partial<FlowChip> = {}): FlowChip => ({ key: 'b-food', label: 'Food', selected: false, onPress: () => {}, icon: <Probe />, ...over })

describe('FlowChipItem (QA-84)', () => {
  it('skips a re-render when the page hands it an equal chip object, redraws when what it shows changes', () => {
    renders = 0
    const { rerender } = render(<FlowChipItem chip={chip()} />)
    expect(renders).toBe(1)
    rerender(<FlowChipItem chip={chip()} />)
    expect(renders).toBe(1)
    rerender(<FlowChipItem chip={chip({ label: 'Fuel' })} />)
    expect(renders).toBe(2)
  })
})
