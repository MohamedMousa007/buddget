import { describe, expect, it } from 'vitest'
import { newBlock, parseBlocks, renderBlocks } from './blocks'
import { BUILTIN_SCENARIOS, EMAIL_LOCALES, chooseLocale } from './scenarios'
import { builtinTemplate } from './defaults'
import { missingVariables, renderTemplate, withDefaults, withPreheader } from './render'
import { hasErrors, validateTemplate } from './validate'
import { extractVariables, substitute } from './variables'

const render = (key: string, locale: 'en' | 'ar') => {
  const t = builtinTemplate(key, locale)!
  return { ...t, html: renderBlocks(t.blocks, { locale, subject: t.subject, preheader: t.preheader }) }
}

describe('variables', () => {
  it('escapes values for HTML but not for the subject', () => {
    const vars = { first_name: '<img src=x onerror=alert(1)> & "Sara"' }
    expect(substitute('Hi {{first_name}}', vars, 'html')).toBe('Hi &lt;img src=x onerror=alert(1)&gt; &amp; &quot;Sara&quot;')
    expect(substitute('Hi {{first_name}}', { first_name: 'a\r\nb' }, 'text')).toBe('Hi a b')
  })
  it('leaves unknown or unsupplied names as written and finds every use once', () => {
    expect(substitute('{{ code }} {{nope}}', { code: '1' }, 'html')).toBe('1 {{nope}}')
    expect(extractVariables('{{a}} {{ b }} {{a}}')).toEqual(['a', 'b'])
  })
})

describe('chooseLocale', () => {
  it('uses Arabic only when the saved preference says so', () => {
    expect(chooseLocale('ar')).toBe('ar')
    expect(chooseLocale('en')).toBe('en')
    expect(chooseLocale(undefined)).toBe('en')
    expect(chooseLocale('fr')).toBe('en')
  })
})

describe('blocks', () => {
  it('renders Arabic right-to-left with a font that has Arabic glyphs, and keeps the code left-to-right', () => {
    const html = render('sign_in_code', 'ar').html
    expect(html).toContain('<html lang="ar" dir="rtl"')
    expect(html).toContain('Segoe UI')
    expect(html).toMatch(/dir="ltr"[^>]*>\{\{code\}\}/)
    expect(render('sign_in_code', 'en').html).toContain('dir="ltr"')
  })
  it('escapes block text and refuses unsafe URLs', () => {
    const html = renderBlocks([{ ...newBlock('paragraph'), text: '<b>x</b>' } as never, { ...newBlock('button'), url: 'javascript:alert(1)' } as never], { locale: 'en', subject: 's', preheader: 'p' })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('href="#"')
  })
  it('rejects malformed stored blocks instead of repairing them', () => {
    expect(parseBlocks([{ type: 'heading', text: 'x' }])).toBeNull()
    expect(parseBlocks([{ type: 'evil' }])).toBeNull()
    expect(parseBlocks([newBlock('heading')])).toHaveLength(1)
  })
  it('keeps the preheader line in step with the field', () => {
    const t = render('welcome', 'en')
    expect(withPreheader(t.html, 'New <line>')).toContain('New &lt;line&gt;')
    expect(withPreheader(t.html, t.preheader)).toBe(t.html)
  })
})

describe('built-in templates', () => {
  it.each(BUILTIN_SCENARIOS.flatMap((s) => EMAIL_LOCALES.map((l) => [s.key, l] as const)))('%s (%s) passes validation and renders with defaults', (key, locale) => {
    const s = BUILTIN_SCENARIOS.find((x) => x.key === key)!
    const t = render(key, locale)
    expect(hasErrors(validateTemplate(s, t))).toBe(false)
    const vars = withDefaults({ code: '123456', link: 'https://x.test/?a=1&b=2', inviter_name: 'Mo', role: 'Admin' }, locale)
    expect(missingVariables(t, vars)).toEqual([])
    expect(renderTemplate(t, vars).html).not.toContain('{{')
  })
})

describe('validateTemplate', () => {
  const signIn = BUILTIN_SCENARIOS.find((s) => s.key === 'sign_in_code')!
  const base = { subject: 'Hi', preheader: 'p', html: '<p>{{code}}</p>' }
  it('flags unknown variables, variables the scenario does not offer, and a missing code or link', () => {
    expect(validateTemplate(signIn, { ...base, html: '<p>{{nope}}</p>' }).map((i) => i.message).join()).toMatch(/Unknown variable.*nope/)
    expect(validateTemplate(signIn, { ...base, html: '<p>{{code}} {{inviter_name}}</p>' }).map((i) => i.message).join()).toMatch(/Not available.*inviter_name/)
    expect(validateTemplate(signIn, { ...base, html: '<p>hello</p>' }).map((i) => i.message).join()).toMatch(/must include \{\{code\}\} or \{\{link\}\}/)
    expect(hasErrors(validateTemplate(signIn, base))).toBe(false)
  })
  it('enforces the 100 KB limit and blocks scripts', () => {
    expect(hasErrors(validateTemplate(signIn, { ...base, html: `{{code}}${'x'.repeat(101 * 1024)}` }))).toBe(true)
    expect(hasErrors(validateTemplate(signIn, { ...base, html: '{{code}}<script>1</script>' }))).toBe(true)
  })
})
