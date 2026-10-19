import { renderBlocks } from '@/lib/email/blocks'
import { builtinTemplate } from '@/lib/email/defaults'
import { missingVariables, renderTemplate, withDefaults, type RenderableTemplate } from '@/lib/email/render'
import { builtinScenario, type EmailLocale } from '@/lib/email/scenarios'
import type { EmailVars } from '@/lib/email/variables'
import type { ServiceClient } from '@/lib/supabase/service'
import { loadPublished } from './store'

export class MissingVariablesError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing email variables: ${missing.join(', ')}`)
  }
}

export interface RenderedEmail {
  subject: string
  html: string
  locale: EmailLocale
  /** Where the template came from: the published row, or the copy compiled into the app. */
  origin: 'database' | 'builtin'
}

function compiled(key: string, locale: EmailLocale): RenderableTemplate | null {
  const t = builtinTemplate(key, locale)
  return t ? { subject: t.subject, preheader: t.preheader, html: renderBlocks(t.blocks, { locale, subject: t.subject, preheader: t.preheader }) } : null
}

/**
 * The email for `key` in the person's language, with variables filled and HTML-escaped. A missing or broken stored
 * template falls back to the copy compiled into the app, so a bad edit can never block a sign-in.
 */
export async function renderEmail(service: ServiceClient, key: string, locale: EmailLocale, vars: EmailVars, override?: RenderableTemplate): Promise<RenderedEmail> {
  const supplied = withDefaults(vars, locale, { supportEmail: process.env.SUPPORT_EMAIL?.trim() || undefined })
  const unmet = (builtinScenario(key)?.required ?? []).filter((v) => !vars[v])
  if (unmet.length) throw new MissingVariablesError(unmet)

  const candidates: Array<{ t: RenderableTemplate | null; locale: EmailLocale; origin: RenderedEmail['origin'] }> = [
    { t: await loadPublished(service, key, locale), locale, origin: 'database' },
    ...(locale === 'ar' ? [{ t: await loadPublished(service, key, 'en'), locale: 'en' as const, origin: 'database' as const }] : []),
    { t: compiled(key, locale), locale, origin: 'builtin' },
    { t: compiled(key, 'en'), locale: 'en', origin: 'builtin' },
  ]
  if (override) {
    const missing = missingVariables(override, supplied)
    if (missing.length) throw new MissingVariablesError(missing)
    return { ...renderTemplate(override, supplied), locale, origin: 'database' }
  }
  let lastMissing: string[] = []
  for (const c of candidates) {
    if (!c.t) continue
    const missing = missingVariables(c.t, supplied)
    if (missing.length) {
      lastMissing = missing
      continue
    }
    return { ...renderTemplate(c.t, supplied), locale: c.locale, origin: c.origin }
  }
  if (lastMissing.length) throw new MissingVariablesError(lastMissing)
  throw new Error(`No email template for "${key}"`)
}

