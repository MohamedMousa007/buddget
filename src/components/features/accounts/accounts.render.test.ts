import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PaymentMethod } from '@/lib/store/types'
import { AccountRow } from './AccountRow'
import { CardStrip } from './CardStrip'
import { BrandMark } from './BrandMark'
import { monogram, splitMoney } from './accountDisplay'

const pm = (o: Partial<PaymentMethod> & Pick<PaymentMethod, 'id' | 'type' | 'name'>): PaymentMethod =>
  ({ currency: 'EGP', isDefault: false, ...o }) as PaymentMethod
const bank = pm({ id: 'b', type: 'bank_account', name: 'CIB ••2016', last4: '2016', color: '#1E4E9B' })
const visa = pm({ id: 'v', type: 'debit_card', name: 'Visa Debit ••4417', last4: '4417', color: '#3669BB', parentId: 'b' })
const mc = pm({ id: 'm', type: 'credit_card', name: 'Mastercard Platinum ••8821', last4: '8821', color: '#5560D8', parentId: 'b' })
const bal = { id: 'b', currency: 'EGP', balance: 84250, held: 25000, free: 59250, approx: false }
const noop = () => {}

describe('accounts UI renders', () => {
  it('row shows title without the digits baked into the name, balance, free amount and both cards', () => {
    const html = renderToStaticMarkup(h(AccountRow, { account: { method: bank, cards: [visa, mc], balance: bal }, masked: false, onOpen: noop, onAddCard: noop }))
    expect(html).toContain('CIB')
    expect(html).toContain('••2016')
    expect(html).toContain('84,250')
    expect(html).toContain('59,250')
    expect(html).toContain('2 cards')
  })
  it('a mini card shows the bank abbreviation left, the card type right, then ••last4', () => {
    const html = renderToStaticMarkup(h(CardStrip, { cards: [visa], onOpen: noop, onAddCard: noop, parent: bank }))
    const bankAt = html.indexOf('data-slot="bank"')
    const kindAt = html.indexOf('data-slot="kind"')
    const digitsAt = html.indexOf('data-slot="digits"')
    expect(bankAt).toBeGreaterThan(-1)
    expect(bankAt).toBeLessThan(kindAt)
    expect(kindAt).toBeLessThan(digitsAt)
    expect(html).toMatch(/data-slot="bank"[^>]*>CIB</)
    expect(html).toMatch(/data-slot="kind"[^>]*>Debit</)
    expect(html).toMatch(/data-slot="digits"[^>]*>••4417</)
    expect(html).toContain('w-[88px]')
    expect(html).toContain('h-14')
    expect(html).toContain('rounded-[7px]')
  })
  it('a mini card without a parent abbreviates its own provider and localizes wallet', () => {
    const html = renderToStaticMarkup(h(CardStrip, { cards: [pm({ id: 'w', type: 'wallet', name: 'Banque Misr ••12', last4: '12' })], onOpen: noop, onAddCard: noop }))
    expect(html).toMatch(/data-slot="bank"[^>]*>BM</)
    expect(html).toMatch(/data-slot="kind"[^>]*>Wallet</)
  })
  it('masks amounts but not identity', () => {
    const html = renderToStaticMarkup(h(AccountRow, { account: { method: bank, cards: [], balance: bal }, masked: true, onOpen: noop, onAddCard: noop }))
    expect(html).toContain('••••••')
    expect(html).not.toContain('84,250')
    expect(html).toContain('Add a card')
  })
  it('an account without a balance asks for one and a gap becomes the exception', () => {
    expect(renderToStaticMarkup(h(AccountRow, { account: { method: bank, cards: [], balance: null }, masked: false, onOpen: noop, onAddCard: noop }))).toContain('Set balance')
    expect(renderToStaticMarkup(h(AccountRow, { account: { method: bank, cards: [], balance: bal }, masked: false, gap: -1200, onOpen: noop, onFix: noop, onAddCard: noop }))).toContain('1,200 missing')
  })
  it('strip caps at two faces and counts the rest', () => {
    const html = renderToStaticMarkup(h(CardStrip, { cards: [visa, mc, pm({ id: 'x', type: 'prepaid_card', name: 'Prepaid ••1', last4: '1' })], onOpen: noop, onAddCard: noop }))
    expect(html).toContain('+1')
    expect(html).toContain('3 cards')
  })
  it('helpers', () => {
    expect(monogram('CIB')).toBe('CIB')
    expect(monogram('Vodafone Cash')).toBe('VC')
    expect(splitMoney(-1234.5, 'EGP')).toEqual({ int: '−1,234', dec: '.50' })
    expect(splitMoney(1, 'KWD').dec).toBe('.000')
  })
})

describe('BrandMark logo variant (BDG-024)', () => {
  it('draws the logo padded on a white tile and keeps the alert badge', () => {
    const html = renderToStaticMarkup(h(BrandMark, { name: 'CIB', color: '#1E4E9B', logo: '/logos/banks/cib.svg', alert: true }))
    expect(html).toContain('src="/logos/banks/cib.svg"')
    expect(html).toContain('bg-white')
    expect(html).toContain('>!</span>')
    expect(html).not.toContain('>CIB<')
  })
  it('without a logo it is the monogram on the brand colour, as before', () => {
    const html = renderToStaticMarkup(h(BrandMark, { name: 'Nile Crest Bank', color: '#1E4E9B', logo: null }))
    expect(html).not.toContain('<img')
    expect(html).not.toContain('data-brand-logo')
    expect(html).toContain('>NC<')
    expect(html).toContain('background:#1E4E9B')
  })
  it('a logo with logoBg draws on that colour, without the white tile, and keeps the alert badge', () => {
    const html = renderToStaticMarkup(h(BrandMark, { name: 'Weyay', color: '#1E4E9B', logo: '/logos/banks/weyay.svg', logoBg: '#11042A', alert: true }))
    expect(html).toContain('src="/logos/banks/weyay.svg"')
    expect(html).toContain('background:#11042A')
    expect(html).not.toContain('bg-white')
    expect(html).toContain('>!</span>')
  })
  it('Weyay picks up its brand tile without the prop; other logos stay white with no inline background', () => {
    const weyay = renderToStaticMarkup(h(BrandMark, { name: 'Weyay', color: '#1E4E9B', logo: '/logos/banks/weyay.svg' }))
    expect(weyay).toContain('background:#11042A')
    const cib = renderToStaticMarkup(h(BrandMark, { name: 'CIB', color: '#1E4E9B', logo: '/logos/banks/cib.svg' }))
    expect(cib).toContain('bg-white')
    expect(cib).not.toContain('background:')
  })
})
