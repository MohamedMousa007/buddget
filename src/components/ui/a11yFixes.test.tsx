import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DOMParser } from '@xmldom/xmldom'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'
import { AuthOtpRow } from '@/components/features/auth-modal/AuthOtpRow'
import { ColorSwatchRow } from './ColorSwatchRow'
import { SegmentedControl } from './SegmentedControl'
import { nextSegmentIndex } from './segmentedNav'
import { documentTitleFor, shouldMoveFocus } from '@/components/layout/routeAnnounce'
import { RouteAnnouncer } from '@/components/layout/RouteAnnouncer'
import { SkipLink } from '@/components/layout/SkipLink'

const SRC = join(__dirname, '../..')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')
const dom = (html: string) => new DOMParser().parseFromString(`<root>${html}</root>`, 'text/xml')
const all = (html: string, tag: string) => Array.from(dom(html).getElementsByTagName(tag))

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

describe('A11-3 OTP inputs have names', () => {
  const html = renderToStaticMarkup(h(AuthOtpRow, { value: '12', onChange: () => {} }))
  const inputs = all(html, 'input')

  it('six inputs, each named "Digit N of 6", inside a labelled group', () => {
    expect(inputs).toHaveLength(6)
    inputs.forEach((el, i) => expect(el.getAttribute('aria-label')).toBe(en.a11y.otpDigit(i + 1, 6)))
    expect(all(html, 'div')[0].getAttribute('role')).toBe('group')
    expect(all(html, 'div')[0].getAttribute('aria-label')).toBe(en.a11y.otpCode)
  })

  it('the first box offers the platform one-time-code autofill', () => {
    expect(inputs[0].getAttribute('autoComplete')).toBe('one-time-code')
  })

  it('Arabic names exist and carry the position', () => {
    expect(ar.a11y.otpDigit(3, 6)).toContain('3')
    expect(ar.a11y.otpDigit(3, 6)).not.toBe(en.a11y.otpDigit(3, 6))
    expect(ar.a11y.otpCode).not.toBe(en.a11y.otpCode)
  })

  it('digits typed or pasted in Arabic-Indic form are kept (TZL-4)', () => {
    const src = read('components/features/auth-modal/AuthOtpRow.tsx')
    expect(src.match(/toLatinDigits\(/g)?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('A11-4 Zakat and amount inputs have names', () => {
  it('every per-asset and debts input is built with a label', () => {
    const src = read('components/features/savings-v3/ZakatSheet.tsx')
    expect(src).toMatch(/lineInput = \(id: LineId, live: number, label: string\)/)
    expect(src).toContain("'aria-label': label")
    const calls = src.match(/lineInput\([^)]*\)/g)!.filter((c) => !c.includes('LineId'))
    expect(calls.length).toBeGreaterThanOrEqual(2)
    for (const c of calls) expect(c.split(',').length, c).toBe(3)
  })

  it('amount-received and year-search inputs are named', () => {
    expect(read('components/modals/AmountReceivedSheet.tsx')).toContain('aria-label={t.income.amountReceivedLabel}')
    expect(read('components/ui/UnifiedDatePicker.tsx')).toContain('aria-label={t.inlineCopy.yearPicker.typeYear}')
  })
})

describe('A11-5 ColorSwatchRow selection', () => {
  const colors = ['#2E5AAC', '#E8A200', '#22232E']
  const html = renderToStaticMarkup(h(ColorSwatchRow, { value: '#E8A200', onChange: () => {}, colors }))
  const radios = all(html, 'button')

  it('is a radiogroup of radios with exactly the chosen one checked', () => {
    expect(all(html, 'div')[0].getAttribute('role')).toBe('radiogroup')
    expect(radios.map((b) => b.getAttribute('role'))).toEqual(['radio', 'radio', 'radio'])
    expect(radios.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
  })

  it('every swatch keeps its colour name; the selected one shows a check and a token ring', () => {
    radios.forEach((b, i) => expect(b.getAttribute('aria-label')).toBe(en.a11y.colour(colors[i])))
    expect(radios.map((b) => b.getElementsByTagName('svg').length)).toEqual([0, 1, 0])
    expect(radios[1].getAttribute('style')).toContain('var(--color-brand-focus)')
    expect(radios[1].getAttribute('style')).not.toContain('#fff')
  })

  it('the check reads against its swatch (dark ink on amber)', () => {
    expect(radios[1].getAttribute('style')).toContain('color:var(--color-brand-ink-dark)')
  })
})

describe('A11-6 SegmentedControl arrows move focus with selection', () => {
  it('arrow keys wrap, Home/End jump, other keys are ignored', () => {
    expect(nextSegmentIndex('ArrowRight', 2, 3)).toBe(0)
    expect(nextSegmentIndex('ArrowDown', 0, 3)).toBe(1)
    expect(nextSegmentIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(nextSegmentIndex('ArrowUp', 2, 3)).toBe(1)
    expect(nextSegmentIndex('Home', 2, 3)).toBe(0)
    expect(nextSegmentIndex('End', 0, 3)).toBe(2)
    expect(nextSegmentIndex('a', 0, 3)).toBeNull()
    expect(nextSegmentIndex('ArrowRight', -1, 3)).toBeNull()
    expect(nextSegmentIndex('ArrowRight', 0, 0)).toBeNull()
  })

  it('renders a radiogroup with a roving tabindex', () => {
    const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]
    const html = renderToStaticMarkup(h(SegmentedControl, { options, value: 'b', onChange: () => {}, ariaLabel: 'Pick' }))
    const radios = all(html, 'button')
    expect(radios.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(radios.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
  })

  it('the key handler moves DOM focus to the new radio, not just the selection', () => {
    const src = read('components/ui/SegmentedControl.tsx')
    expect(src).toMatch(/nextSegmentIndex\(e\.key/)
    expect(src).toMatch(/\[role="radio"\]'?\)\[next\]\?\.focus\(\)/)
  })
})

describe('A11-7 route announcements and skip link', () => {
  it('title is the view heading then the app name', () => {
    expect(documentTitleFor('Flow')).toBe('Flow · Buddget')
    expect(documentTitleFor('  Net   worth ')).toBe('Net worth · Buddget')
    expect(documentTitleFor(null)).toBe('Buddget')
    expect(documentTitleFor('')).toBe('Buddget')
  })

  it('focus is only moved when no dialog is open and the user is not typing', () => {
    expect(shouldMoveFocus({ dialogOpen: false, typing: false })).toBe(true)
    expect(shouldMoveFocus({ dialogOpen: true, typing: false })).toBe(false)
    expect(shouldMoveFocus({ dialogOpen: false, typing: true })).toBe(false)
  })

  it('a persistent polite live region and a skip link render', () => {
    const live = all(renderToStaticMarkup(h(RouteAnnouncer)), 'div')[0]
    expect(live.getAttribute('role')).toBe('status')
    expect(live.getAttribute('aria-live')).toBe('polite')
    const skip = all(renderToStaticMarkup(h(SkipLink)), 'a')[0]
    expect(skip.getAttribute('href')).toBe('#main-content')
    expect(skip.textContent).toBe(en.a11y.skipToContent)
    expect(ar.a11y.skipToContent).not.toBe(en.a11y.skipToContent)
  })

  it('AppShell mounts both and gives <main> the target id and a programmatic tabindex', () => {
    const src = read('components/layout/AppShell.tsx')
    expect(src).toContain('<SkipLink />')
    expect(src).toContain('<RouteAnnouncer />')
    expect(src).toMatch(/<main\s+id=\{MAIN_ID\}\s+tabIndex=\{-1\}/)
  })
})

describe('A11-8 text follows the user text size', () => {
  it('no px font size up to 15.5px remains in the app UI (rem scales with the iOS root size)', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      if (/\.test\.|\/(site-ar|site-en)\)?\/|\(site-|components\/site|admin|fitText\.ts$/.test(file)) continue
      for (const m of readFileSync(file, 'utf8').matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(m[1]) <= 15.5) offenders.push(`${file.slice(SRC.length)}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the iOS shell ties the root font size to Dynamic Type', () => {
    const swift = readFileSync(join(SRC, '../ios/App/App/BuddgetViewController.swift'), 'utf8')
    expect(swift).toContain('UIFontMetrics(forTextStyle: .body)')
    expect(swift).toContain('UIContentSizeCategory.didChangeNotification')
    expect(swift).toContain('documentElement.style.fontSize')
  })
})

describe('A11-1 no hard-white label on a solid semantic fill', () => {
  it('no source line puts text-white on the red, green or amber fill', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      if (/\.test\.|\(site-|components\/site|admin/.test(file)) continue
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/text-white\b/.test(line) && /bg-\[var\(--color-brand-(red|green|amber)(-hover)?\)\]|bg-brand-(red|green|amber)\b/.test(line)) {
          offenders.push(`${file.slice(SRC.length)}:${i + 1}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  it('the success and destructive-solid buttons use the on-colour tokens', () => {
    const src = read('components/ui/buttonVariants.ts')
    expect(src).toContain('text-[var(--color-brand-on-red)]')
    expect(src).toContain('text-[var(--color-brand-on-green)]')
  })
})
