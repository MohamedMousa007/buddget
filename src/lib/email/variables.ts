/** Template variables. Pure: shared by the editor preview, the validator and the server renderer. */

export const EMAIL_VARIABLES = {
  first_name: { label: 'First name', sample: 'Sara' },
  full_name: { label: 'Full name', sample: 'Sara Ahmed' },
  email: { label: 'Email address', sample: 'sara@example.com' },
  code: { label: 'One-time code', sample: '482915' },
  link: { label: 'Action link', sample: 'https://buddget.app/auth/callback?token=sample' },
  expires_in: { label: 'Expires in', sample: '10 minutes' },
  app_name: { label: 'App name', sample: 'Buddget' },
  support_email: { label: 'Support email', sample: 'support@buddget.app' },
  inviter_name: { label: 'Inviter name', sample: 'Mohamed' },
  role: { label: 'Role', sample: 'Administrator' },
  year: { label: 'Year', sample: String(new Date().getFullYear()) },
} as const

export type EmailVariable = keyof typeof EMAIL_VARIABLES

export const EMAIL_VARIABLE_KEYS = Object.keys(EMAIL_VARIABLES) as EmailVariable[]

export type EmailVars = Partial<Record<EmailVariable, string>>

const TOKEN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Every distinct `{{name}}` in the text, in order of first use. */
export function extractVariables(text: string): string[] {
  const seen = new Set<string>()
  for (const m of text.matchAll(TOKEN)) seen.add(m[1]!)
  return [...seen]
}

/** Replaces `{{name}}`. `html` escapes the value for markup; `text` (subjects) only strips line breaks. Unknown or absent names are left as written. */
export function substitute(text: string, vars: Record<string, string | undefined>, mode: 'html' | 'text'): string {
  return text.replace(TOKEN, (whole, name: string) => {
    const v = vars[name]
    if (v === undefined) return whole
    return mode === 'html' ? escapeHtml(v) : v.replace(/[\r\n]+/g, ' ')
  })
}

/** Arabic sample values, so the Arabic preview isn't full of English fragments. */
export const ARABIC_SAMPLES: Partial<Record<EmailVariable, string>> = {
  first_name: 'سارة',
  full_name: 'سارة أحمد',
  expires_in: '10 دقائق',
  inviter_name: 'محمد',
  role: 'مدير',
}
