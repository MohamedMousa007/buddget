import { describe, expect, it } from 'vitest'
import { lineEditPatch, patchInBase, type LineEditInput } from '@/lib/budget/lineEdit'

const input = (over: Partial<LineEditInput> = {}): LineEditInput => ({
  shown: 4900, value: 4900, base: 'EGP', linked: false, essential: false, locked: false, isBill: false, dueDay: null, ...over,
})

describe('lineEditPatch', () => {
  it('leaves the amount and currency alone when the amount was not edited', () => {
    expect(lineEditPatch(input({ essential: true }))).toEqual({ essential: true, locked: false })
  })
  it('writes an edited amount in base, with the currency it is in', () => {
    expect(lineEditPatch(input({ value: 5200 }))).toMatchObject({ amount: 5200, currency: 'EGP' })
  })
  it('never writes the amount of a linked line', () => {
    expect(lineEditPatch(input({ value: 1, linked: true }))).not.toHaveProperty('amount')
  })
  it('writes the due day only for bills', () => {
    expect(lineEditPatch(input({ isBill: true, dueDay: 12 }))).toMatchObject({ dueDay: 12 })
    expect(lineEditPatch(input({ dueDay: 12 }))).not.toHaveProperty('dueDay')
  })
})

describe('patchInBase', () => {
  it('tags an amount patch with base, so a row kept in another currency is not left holding base money', () => {
    expect(patchInBase({ amount: 900 }, 'EGP')).toEqual({ amount: 900, currency: 'EGP' })
  })
  it('leaves patches without an amount, or with their own currency, as they are', () => {
    expect(patchInBase({ locked: true }, 'EGP')).toEqual({ locked: true })
    expect(patchInBase({ amount: 5, currency: 'USD' }, 'EGP')).toEqual({ amount: 5, currency: 'USD' })
  })
})
