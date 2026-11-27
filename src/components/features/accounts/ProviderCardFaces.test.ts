import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PaymentMethod } from '@/lib/store/types'
import type { ProviderFace } from '@/lib/accounts/providerGroups'
import { ProviderCardFaces, facesFitInRow } from './ProviderCardFaces'

const pm = (o: Partial<PaymentMethod> & Pick<PaymentMethod, 'id' | 'type' | 'name'>): PaymentMethod =>
  ({ currency: 'EGP', isDefault: false, ...o }) as PaymentMethod
const bank = pm({ id: 'b', type: 'bank_account', name: 'CIB ••2016', last4: '2016' })
const face = (id: string, type: PaymentMethod['type'], last4: string): ProviderFace =>
  ({ method: pm({ id, type, name: `CIB ••${last4}`, last4, parentId: 'b' }), parentAccountId: 'b', isAccount: false })
const faces = [face('a', 'debit_card', '4821'), face('c', 'credit_card', '6120'), face('d', 'debit_card', '7745'), face('e', 'debit_card', '3390')]
const noop = () => {}
const render = (list: ProviderFace[], emptyLabel?: string) =>
  renderToStaticMarkup(h(ProviderCardFaces, { faces: list, label: `${list.length} cards`, parentOf: () => bank, onFace: noop, onAddCard: noop, emptyLabel }))

describe('ProviderCardFaces (v9)', () => {
  it('fits a row while the faces and the dashed slot fit', () => {
    expect(facesFitInRow(2, 324)).toBe(true)
    expect(facesFitInRow(3, 324)).toBe(false)
  })

  it('row: each face is its own button, then the dashed add slot; no "Show all"', () => {
    const html = render(faces.slice(0, 2))
    expect(html.match(/data-card-face="mini"/g)).toHaveLength(2)
    expect(html.match(/<button/g)).toHaveLength(3)
    expect(html).not.toContain('Show all')
  })

  it('stack: first card on top at the left, later ones behind, folded faces hidden from AT, slot after the stack', () => {
    const html = render(faces)
    const z = [...html.matchAll(/translateX\((\d+)px\);z-index:(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(z).toEqual([[0, 4], [52, 3], [104, 2], [156, 1]])
    expect(html.match(/tabindex="-1"/g)).toHaveLength(3)
    expect(html).toContain('translateX(252px)')
    expect(html).not.toContain('Show all')
  })

  it('empty: the dashed slot with its caption only when asked', () => {
    expect(render([])).toBe('')
    expect(render([], 'Add a card')).toContain('Add a card')
  })
})
