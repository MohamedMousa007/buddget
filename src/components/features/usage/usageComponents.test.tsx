import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/i18n', () => ({ useLocale: () => ({ locale: 'en' }) }))
import { UsageMeter, countSegments, meterLevel } from './UsageMeter'
import { SparksPackPicker, defaultPackId, packBlurb, withProBonus } from './SparksPackPicker'
import { usageCopy } from '@/lib/i18n/usageCopy'

describe('UsageMeter', () => {
  it('is teal under 80%, amber from 80% and red at 100%', () => {
    expect(meterLevel(42)).toBe('ok')
    expect(meterLevel(80)).toBe('warn')
    expect(meterLevel(99)).toBe('warn')
    expect(meterLevel(100)).toBe('full')
    expect(meterLevel(null)).toBe('ok')
  })
  it('draws a labelled track, and nothing for a plan without a limit', () => {
    const html = renderToStaticMarkup(createElement(UsageMeter, { label: 'This week', pct: 61, value: '61%', note: 'Resets Sat' }))
    expect(html).toContain('This week')
    expect(html).toContain('61%')
    expect(html).toContain('data-level="ok"')
    expect(renderToStaticMarkup(createElement(UsageMeter, { label: 'x', pct: null, value: '—' }))).not.toContain('role="progressbar"')
  })
  it('the count variant fills one segment per use', () => {
    expect(countSegments(7, 10).filter((s) => s === 'kept')).toHaveLength(7)
    expect(countSegments(7, 10)).toHaveLength(10)
    expect(renderToStaticMarkup(createElement(UsageMeter, { kind: 'count', label: 'Views', used: 10, limit: 10, value: '10 of 10' }))).toContain('data-level="full"')
  })
})

describe('SparksPackPicker', () => {
  const packs = [70, 150, 400, 900, 2500].map((s) => ({ id: `p${s}`, sparks: s, price: `$${s}` }))
  it('preselects the middle pack and keeps the largest under More', () => {
    expect(defaultPackId(packs)).toBe('p400')
    const html = renderToStaticMarkup(createElement(SparksPackPicker, { packs, selected: 'p400', onSelect: () => {}, bonusPercent: 0 }))
    expect(html).toContain('More packs')
    expect(html).not.toContain('$2500')
    expect(html).toContain('aria-checked="true"')
  })
  it('Pro sees the real amount with its bonus already added, with the base beside it', () => {
    expect(withProBonus(70, 15)).toBe(80)
    expect(withProBonus(650, 20)).toBe(780)
    expect(withProBonus(400, 0)).toBe(400)
    const html = renderToStaticMarkup(createElement(SparksPackPicker, { packs, selected: 'p400', onSelect: () => {}, bonusPercent: 15 }))
    expect(html).toContain('80')
    expect(html).toContain('+15% with Pro, base 70')
  })
  it('says in plain words what a pack buys, from the cost table', () => {
    const c = usageCopy.en.packs
    expect(packBlurb(70, c)).toBe('About 230 quick answers')
    expect(packBlurb(150, c)).toBe('About 500 quick answers or 48 receipt scans')
    expect(packBlurb(900, c)).toBe('About 6 extra weeks of Pro-level use')
  })
})
