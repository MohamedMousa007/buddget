import { describe, expect, it, vi } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PAYMENT_BRANDS } from '@/lib/payment/paymentMethodDefaults'
import { en } from '@/lib/i18n/dictionaries/en'
import { ProviderPickerSheet, filterPickerItems, type ProviderPickerItem } from './ProviderPickerSheet'
import { BANK_LOGO_FILES } from '@/lib/payment/bankLogos'

// ModalShell portals into document.body; render its panel inline for the static render.
vi.mock('@/components/modals/ModalShell', () => ({ ModalShell: ({ children }: { children: ReactNode }) => children, useModalTitleId: () => 'modal-title' }))

const pockets: ProviderPickerItem[] = [
  { id: 'p1', name: 'Monthly Savings', subtitle: 'Vault', glyph: h('i', { id: 'g-p1' }), trailing: h('span', null, '1,250') },
  { id: 'p2', name: 'Trip fund', subtitle: 'At home', glyph: h('i', { id: 'g-p2' }), trailing: h('span', null, '400') },
]

const noop = () => {}
const brandName = Object.values(PAYMENT_BRANDS).find((b) => /^[A-Za-z0-9 ]+$/.test(b.name))!.name

describe('ProviderPickerSheet, pocket variant (BDG-026-028)', () => {
  const html = renderToStaticMarkup(h(ProviderPickerSheet, {
    open: true, selectedId: 'p2', items: pockets, title: 'Choose a pocket',
    searchPlaceholder: 'Search pockets', customLabel: 'Add pocket', onPick: noop, onCustom: noop, onClose: noop,
  }))
  it('lists the pockets with their glyph and balance, not the brand catalogue', () => {
    expect(html).toContain('Monthly Savings')
    expect(html).toContain('Trip fund')
    expect(html).toContain('1,250')
    expect(html).toContain('id="g-p2"')
    expect(html).not.toContain(en.paymentMethods.allProviders)
    expect(html).not.toContain(brandName)
  })
  it('uses the pocket title, search and Add pocket action, and marks the chosen pocket', () => {
    expect(html).toContain('Choose a pocket')
    expect(html).toContain('placeholder="Search pockets"')
    expect(html).toContain('Add pocket')
    expect(html).toContain('role="radiogroup"')
    expect(html.match(/aria-checked="true"/g)?.length).toBe(1)
  })
  it('hides the action when no onCustom is given (Withdraw)', () => {
    const w = renderToStaticMarkup(h(ProviderPickerSheet, { open: true, selectedId: null, items: pockets, customLabel: 'Add pocket', onPick: noop, onClose: noop }))
    expect(w).not.toContain('Add pocket')
  })
  it('search matches name or subtitle', () => {
    expect(filterPickerItems(pockets, 'trip').map((i) => i.id)).toEqual(['p2'])
    expect(filterPickerItems(pockets, ' VAULT ').map((i) => i.id)).toEqual(['p1'])
    expect(filterPickerItems(pockets, '')).toHaveLength(2)
  })
})

describe('ProviderPickerSheet, provider mode unchanged', () => {
  it('still lists the catalogue with its sections, title and Add custom', () => {
    const html = renderToStaticMarkup(h(ProviderPickerSheet, { open: true, selectedId: null, popularIds: [], onPick: noop, onCustom: noop, onClose: noop }))
    expect(html).toContain(en.paymentMethods.chooseProvider)
    expect(html).toContain(en.paymentMethods.allProviders)
    expect(html).toContain(brandName)
    expect(html).toContain(en.paymentMethods.addCustom)
    expect(html).toContain(en.paymentMethods.searchProviderPlaceholder)
    expect(html).not.toContain('role="radiogroup"')
  })
})

describe('ProviderPickerSheet, bank logos (BDG-024)', () => {
  const html = renderToStaticMarkup(h(ProviderPickerSheet, { open: true, selectedId: null, popularIds: [], onPick: noop, onClose: noop }))
  it('a bank with a logo file shows it on the white tile', () => {
    const [id, file] = Object.entries(BANK_LOGO_FILES)[0]
    expect(html).toContain(`src="/logos/banks/${file}"`)
    expect(html).toContain(PAYMENT_BRANDS[id].name)
    expect(html).toContain('data-brand-logo')
  })
  it('a brand without a file keeps its tinted initials', () => {
    const b = Object.values(PAYMENT_BRANDS).find((x) => !BANK_LOGO_FILES[x.id] && /^[A-Z]+$/.test(x.short))!
    expect(html).toMatch(new RegExp(`>${b.short}</span>`))
    expect(html).not.toContain(`/logos/banks/${b.id}.`)
  })
})
