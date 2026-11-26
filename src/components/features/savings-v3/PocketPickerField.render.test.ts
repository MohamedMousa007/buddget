import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProviderPickerSheetProps } from '@/components/features/payments/ProviderPickerSheet'
import { PocketPickerField } from './MoneySheetParts'

// Capture what the field hands the shared picker; the picker's own markup has its own render test.
let picker: ProviderPickerSheetProps | null = null
vi.mock('@/components/features/payments/ProviderPickerSheet', () => ({
  ProviderPickerSheet: (p: ProviderPickerSheetProps) => { picker = p; return null },
}))

const pocket = (id: string, name: string, currentBalance: number) =>
  ({ account: { id, name, type: 'cash', currency: 'EGP', currentBalance, category: 'savings' } }) as never

const pockets = [pocket('a', 'Trip fund', 1250), pocket('b', 'QA Pocket', 400)]

beforeEach(() => { picker = null })

describe('PocketPickerField (Add money Into / Withdraw From)', () => {
  it('shows only the chosen pocket in one field row, labelled for the leg', () => {
    const html = renderToStaticMarkup(h(PocketPickerField, { pockets, value: 'b', onChange: () => {}, label: 'Into' }))
    expect(html).toContain('aria-label="Into: QA Pocket"')
    expect(html).toContain('400')
    expect(html).not.toContain('Trip fund')
  })
  it('hands every pocket to the provider picker with its balance', () => {
    renderToStaticMarkup(h(PocketPickerField, { pockets, value: 'b', onChange: () => {}, label: 'Into' }))
    expect(picker?.items?.map((i) => [i.id, i.name])).toEqual([['a', 'Trip fund'], ['b', 'QA Pocket']])
    expect(picker?.selectedId).toBe('b')
    expect(renderToStaticMarkup(h('div', null, picker?.items?.[0].trailing))).toContain('1,250')
  })
  it('picking a pocket sets the form value', () => {
    const onChange = vi.fn()
    renderToStaticMarkup(h(PocketPickerField, { pockets, value: 'b', onChange, label: 'Into' }))
    picker?.onPick('a')
    expect(onChange).toHaveBeenCalledWith('a')
  })
  it('"New pocket" opens the add-pocket flow', () => {
    const onAdd = vi.fn()
    renderToStaticMarkup(h(PocketPickerField, { pockets, value: 'b', onChange: () => {}, label: 'Into', onAdd }))
    expect(picker?.customLabel).toBe('New pocket')
    picker?.onCustom?.('')
    expect(onAdd).toHaveBeenCalledOnce()
  })
  it('offers no New pocket without onAdd (Withdraw)', () => {
    renderToStaticMarkup(h(PocketPickerField, { pockets, value: 'b', onChange: () => {}, label: 'From' }))
    expect(picker?.onCustom).toBeUndefined()
  })
  it('with no pockets the field asks to choose one', () => {
    const html = renderToStaticMarkup(h(PocketPickerField, { pockets: [], value: null, onChange: () => {}, label: 'Into', onAdd: () => {} }))
    expect(html).toContain('Choose a pocket')
    expect(picker?.items).toEqual([])
  })
  it('lists goals first under Goals, with progress, and reports a goal pick as a goal', () => {
    const onChange = vi.fn()
    const onGoalChange = vi.fn()
    const goals = [{ id: 'g1', name: 'Umrah', glyph: null, saved: 18000, target: 48000 }]
    renderToStaticMarkup(h(PocketPickerField, { pockets, goals, value: 'g1', onChange, onGoalChange, label: 'Goal' }))
    expect(picker?.items?.map((i) => [i.id, i.group])).toEqual([['g1', 'Goals'], ['a', 'Savings'], ['b', 'Savings']])
    expect(picker?.items?.[0].progress).toBeCloseTo(0.375)
    picker?.onPick('g1')
    expect(onGoalChange).toHaveBeenCalledWith('g1')
    expect(onChange).not.toHaveBeenCalled()
  })
  it('only="goals" lists the goals alone and offers New goal', () => {
    const goals = [{ id: 'g1', name: 'Umrah', glyph: null, saved: 0, target: null }]
    renderToStaticMarkup(h(PocketPickerField, { pockets, goals, only: 'goals', value: null, onChange: () => {}, label: 'Goal', onAdd: () => {} }))
    expect(picker?.items?.map((i) => i.id)).toEqual(['g1'])
    expect(picker?.customLabel).toBe('New goal')
  })
})
