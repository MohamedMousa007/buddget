import { EMAIL_VARIABLE_KEYS, extractVariables } from './variables'
import { unsafeEmailHtml } from './safeHtml'
import type { EmailScenario } from './scenarios'

export const MAX_HTML_BYTES = 100 * 1024

export interface TemplateIssue {
  level: 'error' | 'warning'
  message: string
}

/** Checks run in the editor and again on the server before anything is published. */
export function validateTemplate(scenario: EmailScenario, t: { subject: string; preheader: string; html: string }): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  const err = (message: string) => issues.push({ level: 'error', message })
  if (!t.subject.trim()) err('Add a subject.')
  if (!t.html.trim()) err('The email body is empty.')
  if (new TextEncoder().encode(t.html).length > MAX_HTML_BYTES) err('The email is over 100 KB. Gmail clips anything larger.')
  const unsafe = unsafeEmailHtml(t.html)
  if (unsafe) err(unsafe)

  const used = new Set(extractVariables(`${t.subject}\n${t.preheader}\n${t.html}`))
  const unknown = [...used].filter((v) => !(EMAIL_VARIABLE_KEYS as string[]).includes(v))
  if (unknown.length) err(`Unknown variable${unknown.length > 1 ? 's' : ''}: ${unknown.map((v) => `{{${v}}}`).join(', ')}.`)
  const notAllowed = [...used].filter((v) => (EMAIL_VARIABLE_KEYS as string[]).includes(v) && !(scenario.vars as readonly string[]).includes(v))
  if (notAllowed.length) err(`Not available in this email: ${notAllowed.map((v) => `{{${v}}}`).join(', ')}.`)
  if (scenario.requiresAny.length && !scenario.requiresAny.some((v) => used.has(v))) {
    err(`This email must include ${scenario.requiresAny.map((v) => `{{${v}}}`).join(' or ')}.`)
  }
  if (!t.preheader.trim()) issues.push({ level: 'warning', message: 'No preheader: inboxes will show the first line of the body instead.' })
  return issues
}

export const hasErrors = (issues: readonly TemplateIssue[]): boolean => issues.some((i) => i.level === 'error')
