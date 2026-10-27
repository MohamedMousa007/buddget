import { describe, expect, it } from 'vitest'
import type { BudgetPlanCategory } from '@/lib/store/types'
import { lineEditPatch, patchAmountInBase, type LineEditInput } from '@/lib/budget/lineEdit'

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

const rates = { USD: 1, EGP: 50 }
const line = (over: Partial<BudgetPlanCategory>): BudgetPlanCategory =>
  ({ id: 'l', name: 'L', amount: 0, currency: 'EGP', subcategories: [], ...over }) as BudgetPlanCategory

describe('patchAmountInBase', () => {
  it('scales subcategories of a USD line to the new base total without flipping currency (7,536 EGP -> 9,000)', () => {
    const l = line({ currency: 'USD', subcategories: [{ id: 'a', name: 'a', amount: 100 }, { id: 'b', name: 'b', amount: 50 }] })
    const rates2 = { USD: 1, EGP: 50.24 }
    const out = patchAmountInBase(l, { amount: 9000 }, 'EGP', rates2)
    expect(out).not.toHaveProperty('amount')
    expect(out).not.toHaveProperty('currency')
    const sum = out.subcategories!.reduce((s, x) => s + x.amount, 0)
    expect(sum * 50.24).toBeCloseTo(9000, 0)
    expect(out.subcategories![0].amount / out.subcategories![1].amount).toBeCloseTo(2, 1)
  })
  it('converts a base amount into a plain non-base line currency', () => {
    const out = patchAmountInBase(line({ currency: 'USD', amount: 100 }), { amount: 5024 }, 'EGP', { USD: 1, EGP: 50.24 })
    expect(out).toEqual({ amount: 100 })
  })
  it('keeps a plain base line as is', () => {
    expect(patchAmountInBase(line({ amount: 10 }), { amount: 900 }, 'EGP', rates)).toEqual({ amount: 900 })
  })
  it('scales subcategories of a base line instead of ignoring the patch', () => {
    const l = line({ subcategories: [{ id: 'a', name: 'a', amount: 100 }, { id: 'b', name: 'b', amount: 100 }] })
    expect(patchAmountInBase(l, { amount: 400 }, 'EGP', rates).subcategories!.map((s) => s.amount)).toEqual([200, 200])
  })
  it('leaves patches without an amount, or with their own currency, as they are', () => {
    expect(patchAmountInBase(line({}), { locked: true }, 'EGP', rates)).toEqual({ locked: true })
    expect(patchAmountInBase(line({}), { amount: 5, currency: 'USD' }, 'EGP', rates)).toEqual({ amount: 5, currency: 'USD' })
  })
})
