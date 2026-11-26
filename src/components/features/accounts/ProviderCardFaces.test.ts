import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PaymentMethod } from '@/lib/store/types'
import type { ProviderFace } from '@/lib/accounts/providerGroups'
import { ProviderCardFaces } from './ProviderCardFaces'

const pm = (o: Partial<PaymentMethod> & Pick<PaymentMethod, 'id' | 'type' | 'name'>): PaymentMethod =>
  ({ currency: 'EGP', isDefault: false, ...o }) as PaymentMethod
const bank = pm({ id: 'b', type: 'bank_account', name: 'CIB ••2016', last4: '2016' })
const face = (id: string, type: PaymentMethod['type'], last4: string): ProviderFace =>
  ({ method: pm({ id, type, name: `CIB ••${last4}`, last4, parentId: 'b' }), parentAccountId: 'b', isAccount: false })
const faces = [face('a', 'debit_card', '4821'), face('c', 'credit_card', '6120'), face('d', 'debit_card', '7745'), face('e', 'debit_card', '3390')]
const render = (layout: 'row' | 'stack') =>
  renderToStaticMarkup(h(ProviderCardFaces, { faces, label: '4 cards', parentOf: () => bank, layout, room: 324 }))

describe('ProviderCardFaces', () => {
  it('row: every face side by side and the label, with no buttons of its own (the card is the button)', () => {
    const html = render('row')
    expect(html.match(/data-card-face="mini"/g)).toHaveLength(4)
    expect(html).toContain('4 cards')
    expect(html).not.toContain('<button')
  })

  it('stack: first card on top at the left, later ones behind and offset right, folded faces hidden from AT', () => {
    const html = render('stack')
    const z = [...html.matchAll(/translateX\((\d+)px\);z-index:(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(z).toEqual([[0, 4], [52, 3], [104, 2], [156, 1]])
    expect(html.match(/aria-hidden="true"[^>]*tabindex="-1"|tabindex="-1"[^>]*aria-hidden="true"/g)).toHaveLength(4)
  })

  it('stack: a Show all toggle that announces it is collapsed', () => {
    const html = render('stack')
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*Show all/)
  })
})
