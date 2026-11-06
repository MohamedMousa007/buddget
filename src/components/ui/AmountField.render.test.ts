import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const native = vi.hoisted(() => ({ on: false }))
vi.mock('@/lib/native/useIsNativeClient', () => ({ useIsNativeClient: () => native.on }))

import { AmountField } from './AmountField'
import { Input, DEFAULT_MAX_LENGTH } from './input'

const noop = () => {}
const web = (props: Record<string, unknown>) => {
  native.on = false
  return renderToStaticMarkup(h(AmountField, { value: '', onChange: noop, ...props }))
}

describe('AmountField accessible name (FRM-7)', () => {
  it('a money box with no caption gets a generic name instead of being announced as "0"', () => {
    expect(web({ currency: 'EGP', placeholder: '0' })).toContain('aria-label="Amount"')
  })
  it('an explicit aria-label, a label, or an id (for a <label htmlFor>) wins over the fallback', () => {
    expect(web({ 'aria-label': 'Monthly rent' })).toContain('aria-label="Monthly rent"')
    expect(web({ label: 'Target' })).toContain('aria-label="Target"')
    expect(web({ id: 'ef-amount' })).not.toContain('aria-label')
  })
  it('an integer box (a count, a day) is never called "Amount"', () => {
    expect(web({ mode: 'integer' })).not.toContain('aria-label')
  })
  it('on the native pad the button carries the name and the value', () => {
    native.on = true
    const html = renderToStaticMarkup(h(AmountField, { value: '12.5', onChange: noop, currency: 'EGP' }))
    expect(html).toContain('aria-label="Amount: 12.5"')
    native.on = false
  })
})

describe('Input length cap (FRM-12)', () => {
  it('caps a pasted wall of text unless the site sets its own limit', () => {
    expect(renderToStaticMarkup(h(Input, {}))).toContain(`maxLength="${DEFAULT_MAX_LENGTH}"`)
    expect(renderToStaticMarkup(h(Input, { maxLength: 60 }))).toContain('maxLength="60"')
  })
})
