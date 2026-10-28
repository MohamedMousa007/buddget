import { externalHosts, unsafeEmailHtml } from '@/lib/email/safeHtml'
import { parseBlocks, type EmailBlock } from '@/lib/email/blocks'
import { blankTemplate } from '@/lib/email/defaults'
import { withPreheader } from '@/lib/email/render'
import { BUILTIN_SCENARIOS, CUSTOM_KEY_RE, EMAIL_LOCALES, builtinScenario, customScenario, isSecurityScenario, type EmailLocale } from '@/lib/email/scenarios'
import { hasErrors, validateTemplate, MAX_HTML_BYTES } from '@/lib/email/validate'
import { EMAIL_VARIABLES } from '@/lib/email/variables'
import { OWNER_ROLE } from '@/lib/admin/permissions'
import { allowAttempt } from '@/lib/server/admin/credentials'
import { STEP_UP_ERROR, stepUp } from '@/lib/server/admin/stepUp'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { TEMPLATE_COLUMNS, asRow, findScenario, htmlFor, translateInto, writeDraft } from '@/lib/server/email/catalog'
import { sendTemplatedEmail } from '@/lib/server/email/send'
import { invalidateTemplate } from '@/lib/server/email/store'
import type { Json } from '@/lib/supabase/database.types'

const isLocale = (v: unknown): v is EmailLocale => (EMAIL_LOCALES as readonly unknown[]).includes(v)

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'emails.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx
  const key = new URL(req.url).searchParams.get('key')

  if (key) {
    const scenario = await findScenario(service, key)
    if (!scenario) return bad('Unknown email.', 404)
    const [rows, versions] = await Promise.all([
      service.from('email_templates').select(`locale, ${TEMPLATE_COLUMNS}`).eq('key', key),
      service.from('email_template_versions').select('locale, version, published_at').eq('key', key).order('version', { ascending: false }).limit(60),
    ])
    const locales = Object.fromEntries(EMAIL_LOCALES.map((l) => {
      const mine = (rows.data ?? []).filter((r) => r.locale === l)
      return [l, { published: asRow(mine.find((r) => r.status === 'published')), draft: asRow(mine.find((r) => r.status === 'draft')) }]
    }))
    return json({
      scenario,
      locales,
      versions: versions.data ?? [],
      blank: Object.fromEntries(EMAIL_LOCALES.map((l) => [l, blankTemplate(l)])),
      samples: Object.fromEntries(Object.entries(EMAIL_VARIABLES).map(([k, v]) => [k, v.sample])),
    })
  }

  const [rows, custom] = await Promise.all([
    service.from('email_templates').select('key, locale, status, version, updated_at'),
    service.from('email_scenarios').select('key, name, description'),
  ])
  const scenarios = [...BUILTIN_SCENARIOS, ...(custom.data ?? []).map((c) => customScenario(c.key, c.name, c.description))]
  return json({
    scenarios: scenarios.map((s) => ({
      ...s,
      locales: Object.fromEntries(EMAIL_LOCALES.map((l) => {
        const mine = (rows.data ?? []).filter((r) => r.key === s.key && r.locale === l)
        const published = mine.find((r) => r.status === 'published')
        const draft = mine.find((r) => r.status === 'draft')
        const latest = [published?.updated_at, draft?.updated_at].filter(Boolean).sort().pop() ?? null
        return [l, { state: draft ? 'draft' : published ? 'published' : 'none', version: published?.version ?? 0, updatedAt: latest }]
      })),
    })),
  })
}

interface Body {
  op?: string
  key?: string
  locale?: unknown
  version?: number
  name?: string
  description?: string
  subject?: string
  preheader?: string
  mode?: string
  html?: string
  blocks?: unknown
  vars?: Record<string, string>
  code?: string
  stepUpPassword?: string
}

type Content = { subject: string; preheader: string; mode: 'visual' | 'html'; html: string; blocks: EmailBlock[] }

function readContent(b: Body, locale: EmailLocale): Content | string {
  if (typeof b.subject !== 'string' || typeof b.preheader !== 'string' || typeof b.html !== 'string') return 'Missing content.'
  if (b.mode !== 'visual' && b.mode !== 'html') return 'Unknown mode.'
  const blocks = parseBlocks(b.blocks ?? [])
  if (!blocks) return 'The blocks are not valid.'
  const c: Content = { subject: b.subject.slice(0, 200), preheader: b.preheader.slice(0, 300), mode: b.mode, html: b.html, blocks }
  c.html = c.mode === 'visual' ? htmlFor(c, locale) : withPreheader(c.html, c.preheader)
  if (new TextEncoder().encode(c.html).length > MAX_HTML_BYTES) return 'The email is over 100 KB.'
  return c
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'emails.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  const { service } = ctx
  const b = await readJson<Body>(req)
  if (!b?.op) return bad('Unknown action.')

  if (b.op === 'createScenario') {
    const key = (b.key ?? '').trim()
    const name = (b.name ?? '').trim().slice(0, 80)
    if (!CUSTOM_KEY_RE.test(key)) return bad('Use a slug: lowercase letters, numbers and underscores, starting with a letter.')
    if (!name) return bad('Give the email a name.')
    if (builtinScenario(key)) return bad('That key is taken by a built-in email.')
    const { error } = await service.from('email_scenarios').insert({ key, name, description: (b.description ?? '').slice(0, 200), created_by: ctx.staff.id })
    if (error) return bad(error.code === '23505' ? 'That key already exists.' : 'Could not create the email.', error.code === '23505' ? 409 : 500)
    await ctx.audit('emails.scenario_create', { targetType: 'email', targetId: key, summary: `Created email scenario ${key}` })
    return json({ ok: true })
  }

  const key = b.key ?? ''
  const scenario = await findScenario(service, key)
  if (!scenario) return bad('Unknown email.', 404)

  if (b.op === 'deleteScenario') {
    if (!scenario.custom) return bad('Built-in emails can’t be deleted.')
    await service.from('email_templates').delete().eq('key', key)
    await service.from('email_template_versions').delete().eq('key', key)
    await service.from('email_scenarios').delete().eq('key', key)
    invalidateTemplate(key)
    await ctx.audit('emails.scenario_delete', { targetType: 'email', targetId: key, summary: `Deleted email scenario ${key}` })
    return json({ ok: true })
  }

  if (!isLocale(b.locale)) return bad('Unknown language.')
  const locale = b.locale

  if (b.op === 'saveDraft') {
    const c = readContent(b, locale)
    if (typeof c === 'string') return bad(c)
    const unsafe = unsafeEmailHtml(c.html)
    if (unsafe) return bad(unsafe)
    const saved = await writeDraft(service, key, locale, c, ctx.staff.id)
    if ('error' in saved) return bad('Could not save the draft.', 500)
    await ctx.audit('emails.draft_save', { targetType: 'email', targetId: `${key}:${locale}`, summary: `Saved draft of ${key} (${locale})` })
    return json({ ok: true, version: saved.version })
  }

  if (b.op === 'discardDraft') {
    await service.from('email_templates').delete().eq('key', key).eq('locale', locale).eq('status', 'draft')
    await ctx.audit('emails.draft_discard', { targetType: 'email', targetId: `${key}:${locale}`, summary: `Discarded draft of ${key} (${locale})` })
    return json({ ok: true })
  }

  if (b.op === 'publish') {
    const draft = asRow((await service.from('email_templates').select(TEMPLATE_COLUMNS).eq('key', key).eq('locale', locale).eq('status', 'draft').maybeSingle()).data)
    if (!draft) return bad('Save a draft first.')
    const issues = validateTemplate(scenario, draft)
    if (hasErrors(issues)) return json({ error: issues.find((i) => i.level === 'error')!.message, issues }, 422)
    if (isSecurityScenario(key)) {
      if (ctx.role.key !== OWNER_ROLE) return bad('Emails that carry a sign-in link or code can only be published by the owner.', 403)
      if (!(await stepUp(ctx, b))) return bad(STEP_UP_ERROR, 401)
    }
    const previous = asRow((await service.from('email_templates').select(TEMPLATE_COLUMNS).eq('key', key).eq('locale', locale).eq('status', 'published').maybeSingle()).data)
    const published = await service.rpc('publish_email_template', { p_key: key, p_locale: locale, p_staff: ctx.staff.id })
    if (published.error || published.data == null) return bad('Could not publish.', 500)
    invalidateTemplate(key)
    await ctx.audit('emails.publish', { targetType: 'email', targetId: `${key}:${locale}`, summary: `Published ${key} (${locale}) v${draft.version}`, metadata: { version: draft.version, htmlBytes: draft.html.length, previousHtmlBytes: previous?.html.length ?? null, subjectChanged: previous ? previous.subject !== draft.subject : true, hosts: externalHosts(draft.html), security: isSecurityScenario(key) } })
    // The other language follows automatically, as a draft to review, unless someone has already worked on it.
    let translated: EmailLocale | null = null
    let translateNote: string | null = null
    try {
      const t = await translateInto(service, key, locale, ctx.staff.id, false)
      if ('locale' in t) {
        translated = t.locale
        await ctx.audit('emails.auto_translate', { targetType: 'email', targetId: `${key}:${t.locale}`, summary: `Buddgy drafted ${key} (${t.locale}) from ${locale}` })
      } else translateNote = t.skipped
    } catch (e) {
      console.error('[emails/translate]', e instanceof Error ? e.message : e)
      translateNote = 'Buddgy could not translate it this time. Use “Translate with Buddgy” to retry.'
    }
    return json({ ok: true, version: draft.version, translated, translateNote })
  }

  if (b.op === 'translate') {
    const from: EmailLocale = locale === 'en' ? 'ar' : 'en'
    try {
      const t = await translateInto(service, key, from, ctx.staff.id, true)
      if ('skipped' in t) return bad(t.skipped)
      await ctx.audit('emails.auto_translate', { targetType: 'email', targetId: `${key}:${locale}`, summary: `Buddgy drafted ${key} (${locale}) from ${from}` })
      return json({ ok: true })
    } catch (e) {
      console.error('[emails/translate]', e instanceof Error ? e.message : e)
      return bad('Buddgy could not translate it. Try again in a moment.', 502)
    }
  }

  if (b.op === 'revert') {
    const { data: v } = await service.from('email_template_versions').select('subject, preheader, html, mode, blocks').eq('key', key).eq('locale', locale).eq('version', b.version ?? -1).maybeSingle()
    if (!v) return bad('That version no longer exists.', 404)
    const blocks = parseBlocks(v.blocks) ?? []
    const restored = await writeDraft(service, key, locale, { subject: v.subject, preheader: v.preheader, html: v.html, mode: v.mode === 'html' ? 'html' : 'visual', blocks }, ctx.staff.id)
    if ('error' in restored) return bad('Could not restore the version.', 500)
    await ctx.audit('emails.revert', { targetType: 'email', targetId: `${key}:${locale}`, summary: `Restored ${key} (${locale}) v${b.version} as a draft`, metadata: { version: b.version } })
    return json({ ok: true })
  }

  if (b.op === 'test') {
    const c = readContent(b, locale)
    if (typeof c === 'string') return bad(c)
    const unsafe = unsafeEmailHtml(c.html)
    if (unsafe) return bad(unsafe)
    const to = ctx.user.email
    if (!to) return bad('Your account has no email address.')
    if (!(await allowAttempt(service, `email-test:${ctx.staff.id}`, 3600, 10))) return bad('Too many test emails. Try again in an hour.', 429)
    const samples = Object.fromEntries(Object.entries(EMAIL_VARIABLES).map(([k, v]) => [k, v.sample]))
    const sent = await sendTemplatedEmail(key, { email: to, id: ctx.user.id, locale }, { ...samples, ...(b.vars ?? {}), email: to }, { service, source: 'admin', test: true, override: { subject: c.subject, preheader: c.preheader, html: c.html } })
    await ctx.audit('emails.test_send', { targetType: 'email', targetId: `${key}:${locale}`, summary: `Sent a test of ${key} (${locale})` })
    return sent.ok ? json({ ok: true }) : bad('The test email could not be sent. Check the send log.', 502)
  }

  return bad('Unknown action.')
}
