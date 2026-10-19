import { renderBlocks, parseBlocks, type EmailBlock } from '@/lib/email/blocks'
import { builtinTemplate } from '@/lib/email/defaults'
import { BUILTIN_SCENARIOS, EMAIL_LOCALES, builtinScenario, customScenario, type EmailLocale, type EmailScenario } from '@/lib/email/scenarios'
import type { ServiceClient } from '@/lib/supabase/service'
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

export { parseBlocks }
