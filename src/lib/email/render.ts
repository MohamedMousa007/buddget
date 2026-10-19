import { escapeHtml, extractVariables, substitute, type EmailVars } from './variables'
import type { EmailLocale } from './scenarios'

export interface RenderableTemplate {
  subject: string
  preheader: string
  html: string
}

/** Defaults for the variables every email can use, so a template that mentions them never fails to render. */
export function withDefaults(vars: EmailVars, locale: EmailLocale, extra: { supportEmail?: string; now?: Date } = {}): Record<string, string> {
  const ar = locale === 'ar'
  const first = vars.first_name?.trim() || (ar ? 'بك' : 'there')
  return {
    app_name: 'Buddget',
    support_email: extra.supportEmail ?? 'support@buddget.app',
    year: String((extra.now ?? new Date()).getFullYear()),
    expires_in: ar ? '10 دقائق' : '10 minutes',
    ...Object.fromEntries(Object.entries(vars).filter(([, v]) => v !== undefined && v !== '')),
    first_name: first,
    full_name: vars.full_name?.trim() || first,
  } as Record<string, string>
}

export function missingVariables(t: RenderableTemplate, vars: Record<string, string | undefined>): string[] {
  return extractVariables(`${t.subject}\n${t.preheader}\n${t.html}`).filter((v) => vars[v] === undefined)
}

const PREHEADER = /(<div style="display:none; max-height:0;[^>]*>)([\s\S]*?)(<\/div>)/

/** Keeps the hidden inbox-preview line in the body in step with the preheader field, whatever mode produced the HTML. */
export function withPreheader(html: string, preheader: string): string {
  if (PREHEADER.test(html)) return html.replace(PREHEADER, (_m, open: string, _old: string, close: string) => `${open}${escapeHtml(preheader)}${close}`)
  return html.replace(/<body[^>]*>/i, (m) => `${m}\n  <div style="display:none; max-height:0; overflow:hidden; opacity:0; font-size:1px; line-height:1px;">${escapeHtml(preheader)}</div>`)
}

/** Fills the variables, escaping each value for HTML (and stripping line breaks from the subject). */
export function renderTemplate(t: RenderableTemplate, vars: Record<string, string | undefined>): { subject: string; html: string } {
  return {
    subject: substitute(t.subject, vars, 'text'),
    html: substitute(withPreheader(t.html, t.preheader), vars, 'html'),
  }
}
