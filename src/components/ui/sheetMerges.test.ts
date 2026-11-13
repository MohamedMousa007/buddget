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
    expect(html).toContain('text-lg')
    expect(html).toContain('aria-label="Close"')
  })
  it('title shorthand renders the v3 look flush, with subtitle and leading slots', () => {
    const html = renderToStaticMarkup(
      createElement(V3SheetHeader, { title: 'T', subtitle: 'Sub', leading: createElement('i', { id: 'lead' }), onClose: () => {} }),
    )
    expect(html).toContain('<h2')
    expect(html).toContain('text-lg')
    expect(html).toContain('Sub')
    expect(html).toContain('id="lead"')
    expect(html).not.toContain('px-5')
    expect(html).toContain('aria-label="Close"')
  })
  it('compound form keeps its own inset', () => {
    const html = renderToStaticMarkup(
      createElement(V3SheetHeader, { onClose: () => {} } as never, createElement(V3SheetHeader.Title, null, 'Hi')),
    )
    expect(html).toContain('px-5')
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

describe('compact sheet title (SheetFrame sheets)', () => {
  it('is 18px, clamps to two lines, follows the text direction and keeps the full name', () => {
    const html = renderToStaticMarkup(
      createElement(V3SheetHeader, { onClose: () => {} } as never, createElement(V3SheetHeader.Title, { size: 'compact' } as never, 'Amazon Prime Video Channels')),
    )
    expect(html).toContain('text-lg')
    expect(html).toContain('line-clamp-2')
    expect(html).toContain('dir="auto"')
    expect(html).toContain('title="Amazon Prime Video Channels"')
    expect(html).not.toContain('text-[22px]')
  })
  it('the default title is 18px with no clamp', () => {
    const html = renderToStaticMarkup(
      createElement(V3SheetHeader, { onClose: () => {} } as never, createElement(V3SheetHeader.Title, null, 'Hi')),
    )
    expect(html).toContain('text-lg')
    expect(html).not.toContain('line-clamp-2')
  })
  it('the compound form renders a leading control before the title', () => {
    const html = renderToStaticMarkup(
      createElement(V3SheetHeader, { onClose: () => {}, leading: createElement('i', { id: 'back' }) } as never, createElement(V3SheetHeader.Title, null, 'Hi')),
    )
    expect(html.indexOf('id="back"')).toBeGreaterThan(-1)
    expect(html.indexOf('id="back"')).toBeLessThan(html.indexOf('<h2'))
  })
})

describe('dialog title (decision dialogs)', () => {
  it('is centred 18px with no close button', () => {
    const html = renderToStaticMarkup(createElement(V3SheetHeader.DialogTitle, null, 'Change base currency?'))
    expect(html).toContain('<h2')
    expect(html).toContain('text-lg')
    expect(html).toContain('text-center')
    expect(html).not.toContain('aria-label="Close"')
  })
  it('can start-align for a card that opens with an icon', () => {
    const html = renderToStaticMarkup(createElement(V3SheetHeader.DialogTitle, { align: 'start' } as never, 'Turn on notifications'))
    expect(html).not.toContain('text-center')
  })
})
