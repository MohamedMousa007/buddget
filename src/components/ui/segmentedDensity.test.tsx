import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SegmentedControl } from './SegmentedControl'
import { subscriptionsCopyEn, subscriptionsCopyAr } from '@/lib/i18n/subscriptionsCopy'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]
const render = (density?: 'compact') => renderToStaticMarkup(h(SegmentedControl, { options: opts, value: 'a', onChange: () => {}, ariaLabel: 'x', density }))

describe('QA-112 truncated copy', () => {
  it('SegmentedControl keeps px-4 by default and gets px-2 only when compact', () => {
    expect(render()).toContain('px-4')
    expect(render()).not.toContain('px-2')
    expect(render('compact')).toContain('px-2')
    expect(render('compact')).not.toContain('px-4')
  })
  it('the four-option privacy control is compact', () => {
    expect(readFileSync(join(__dirname, '../features/settings/hub/BalancePrivacyCard.tsx'), 'utf8')).toContain('<SegmentedControl density="compact"')
  })
  it('hero cell labels fit a third of a phone, in both languages', () => {
    expect(subscriptionsCopyEn.hero.monthlyEquivalent.length).toBeLessThanOrEqual(12)
    expect(subscriptionsCopyAr.hero.monthlyEquivalent.length).toBeLessThanOrEqual(12)
  })
})
