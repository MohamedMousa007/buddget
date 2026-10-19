import { renderBlocks, parseBlocks, type EmailBlock } from '@/lib/email/blocks'
import { builtinTemplate } from '@/lib/email/defaults'
import { BUILTIN_SCENARIOS, EMAIL_LOCALES, builtinScenario, customScenario, type EmailLocale, type EmailScenario } from '@/lib/email/scenarios'
import type { ServiceClient } from '@/lib/supabase/service'
import { translateTemplate } from './translate'
import type { Json } from '@/lib/supabase/database.types'

export interface TemplateRow {
  subject: string
  preheader: string
  html: string
  mode: 'visual' | 'html'
  blocks: EmailBlock[]
  version: number
  status: 'draft' | 'published'
  updated_at: string
  updated_by: string | null
}

export const TEMPLATE_COLUMNS = 'subject, preheader, html, mode, blocks, version, status, updated_at, updated_by'

export function asRow(r: unknown): TemplateRow | null {
  return r ? (r as TemplateRow) : null
}

/** Visual templates are always re-rendered from their blocks on the server, so stored HTML can't drift from what the editor shows. */
export function htmlFor(t: { mode: string; blocks: EmailBlock[]; html: string; subject: string; preheader: string }, locale: EmailLocale): string {
  return t.mode === 'visual' ? renderBlocks(t.blocks, { locale, subject: t.subject, preheader: t.preheader }) : t.html
}

export async function findScenario(service: ServiceClient, key: string): Promise<EmailScenario | null> {
  const builtin = builtinScenario(key)
  if (builtin) return builtin
  const { data } = await service.from('email_scenarios').select('key, name, description').eq('key', key).maybeSingle()
  return data ? customScenario(data.key, data.name, data.description) : null
}

/** Puts the compiled-in English and Arabic copy in the database the first time, so there is always something to edit. */
export async function ensureSeeded(service: ServiceClient): Promise<void> {
  const { data } = await service.from('email_templates').select('key, locale').eq('status', 'published').in('key', BUILTIN_SCENARIOS.map((s) => s.key))
  const have = new Set((data ?? []).map((r) => `${r.key}:${r.locale}`))
  const rows = []
  for (const s of BUILTIN_SCENARIOS) {
    for (const locale of EMAIL_LOCALES) {
      if (have.has(`${s.key}:${locale}`)) continue
      const t = builtinTemplate(s.key, locale)
      if (!t) continue
      rows.push({
        key: s.key, locale, subject: t.subject, preheader: t.preheader,
        html: renderBlocks(t.blocks, { locale, subject: t.subject, preheader: t.preheader }),
        mode: 'visual', blocks: t.blocks as unknown as Json, status: 'published', version: 1,
      })
    }
  }
  if (rows.length === 0) return
  const { error } = await service.from('email_templates').upsert(rows, { onConflict: 'key,locale,version', ignoreDuplicates: true })
  if (error) console.error('[email/seed] failed', error.message)
  else {
    await service.from('email_template_versions').upsert(
      rows.map(({ key, locale, subject, preheader, html, mode, blocks, version }) => ({ key, locale, subject, preheader, html, mode, blocks, version })),
      { onConflict: 'key,locale,version', ignoreDuplicates: true },
    )
  }
}


export interface DraftContent {
  subject: string
  preheader: string
  mode: 'visual' | 'html'
  html: string
  blocks: EmailBlock[]
}

/** Saves `content` as the working draft of (key, locale), one version above what is published. */
export async function writeDraft(service: ServiceClient, key: string, locale: EmailLocale, content: DraftContent, staffId: string): Promise<{ version: number } | { error: string }> {
  const { data: pub } = await service.from('email_templates').select('version').eq('key', key).eq('locale', locale).eq('status', 'published').maybeSingle()
  const version = (pub?.version ?? 0) + 1
  const row = { key, locale, ...content, blocks: content.blocks as unknown as Json, status: 'draft', version, updated_by: staffId, updated_at: new Date().toISOString() }
  const { data: existing } = await service.from('email_templates').select('id').eq('key', key).eq('locale', locale).eq('status', 'draft').maybeSingle()
  const { error } = existing ? await service.from('email_templates').update(row).eq('id', existing.id) : await service.from('email_templates').insert(row)
  return error ? { error: error.message } : { version }
}

const other = (l: EmailLocale): EmailLocale => (l === 'en' ? 'ar' : 'en')

/**
 * Translates the saved copy of `from` into the other language with Buddgy's model and stores it as that language's
 * draft for review. `force` replaces an existing draft; without it, a language someone has already worked on is left alone.
 */
export async function translateInto(service: ServiceClient, key: string, from: EmailLocale, staffId: string, force: boolean): Promise<{ locale: EmailLocale } | { skipped: string }> {
  const to = other(from)
  const { data } = await service.from('email_templates').select(TEMPLATE_COLUMNS + ', locale').eq('key', key).in('locale', [from, to])
  const rows = (data ?? []) as unknown as Array<TemplateRow & { locale: EmailLocale }>
  const mine = (l: EmailLocale, s: 'draft' | 'published') => rows.find((r) => r.locale === l && r.status === s)
  if (!force) {
    if (mine(to, 'draft')) return { skipped: 'The other language already has a draft.' }
    if ((mine(to, 'published')?.version ?? 1) > 1) return { skipped: 'The other language was edited by hand.' }
  }
  const src = (force ? (mine(from, 'draft') ?? mine(from, 'published')) : mine(from, 'published'))
  if (!src) return { skipped: 'Nothing to translate yet.' }
  const blocks = parseBlocks(src.blocks) ?? []
  if (src.mode === 'html' && src.html !== renderBlocks(blocks, { locale: from, subject: src.subject, preheader: src.preheader })) return { skipped: 'Custom HTML can’t be translated automatically.' }
  const t = await translateTemplate({ subject: src.subject, preheader: src.preheader, blocks }, from, to)
  const result = await writeDraft(service, key, to, { ...t, mode: 'visual', html: renderBlocks(t.blocks, { locale: to, subject: t.subject, preheader: t.preheader }) }, staffId)
  if ('error' in result) throw new Error(result.error)
  return { locale: to }
}
