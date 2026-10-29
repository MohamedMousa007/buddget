import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'

describe('merged sheet header', () => {
  it('v3 variant is the default and keeps its markup', () => {
    const html = renderToStaticMarkup(
      createElement(V3SheetHeader, { onClose: () => {} } as never, createElement(V3SheetHeader.Title, null, 'Hi')),
    )
    expect(html).toContain('text-[22px]')
    expect(html).toContain('aria-label="Close"')
  })
  it('modal variant keeps the h3 look and title row margin', () => {
    const html = renderToStaticMarkup(createElement(V3SheetHeader, { variant: 'modal', title: 'T', onClose: () => {} }))
    expect(html).toContain('<h3')
    expect(html).toContain('mb-4')
  })
  it('bar variant keeps the truncating h2', () => {
    const html = renderToStaticMarkup(createElement(V3SheetHeader, { variant: 'bar', title: 'T', onClose: () => {} }))
    expect(html).toContain('<h2')
    expect(html).toContain('truncate')
  })
})

describe('SettingsSwitchRow tag', () => {
  it('renders the optional tag caption', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsSwitchRow, { label: 'L', tag: 'This device', checked: true, onChange: () => {} }),
    )
    expect(html).toContain('This device')
    expect(html).toContain('uppercase')
  })
})
