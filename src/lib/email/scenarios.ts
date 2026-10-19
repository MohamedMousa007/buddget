import { EMAIL_VARIABLE_KEYS, type EmailVariable } from './variables'

export const EMAIL_LOCALES = ['en', 'ar'] as const
export type EmailLocale = (typeof EMAIL_LOCALES)[number]
export const LOCALE_LABEL: Record<EmailLocale, string> = { en: 'English', ar: 'العربية' }

export interface EmailScenario {
  key: string
  name: string
  usedIn: string
  /** Variables the template may use. */
  vars: readonly EmailVariable[]
  /** The template must contain at least one of these, or the email would be useless. Empty = no rule. */
  requiresAny: readonly EmailVariable[]
  /** The sender must always supply these. */
  required: readonly EmailVariable[]
  custom?: boolean
}

const BASE: readonly EmailVariable[] = ['first_name', 'full_name', 'email', 'app_name', 'support_email', 'year']

export const BUILTIN_SCENARIOS: readonly EmailScenario[] = [
  { key: 'confirm_signup', name: 'Confirm sign-up', usedIn: 'New account: verify the email address', vars: [...BASE, 'code', 'link', 'expires_in'], requiresAny: ['code', 'link'], required: [] },
  { key: 'sign_in_code', name: 'Sign-in code / magic link', usedIn: 'Email sign-in (OTP or magic link)', vars: [...BASE, 'code', 'link', 'expires_in'], requiresAny: ['code', 'link'], required: [] },
  { key: 'password_reset', name: 'Password reset', usedIn: 'Forgot password', vars: [...BASE, 'code', 'link', 'expires_in'], requiresAny: ['code', 'link'], required: [] },
  { key: 'email_change', name: 'Email change', usedIn: 'Changing the account email', vars: [...BASE, 'code', 'link', 'expires_in'], requiresAny: ['code', 'link'], required: [] },
  { key: 'reauthentication', name: 'Re-authentication', usedIn: 'Sensitive actions that need a fresh code', vars: [...BASE, 'code', 'expires_in'], requiresAny: ['code'], required: ['code'] },
  { key: 'invite_admin', name: 'Admin invite', usedIn: 'Team & roles: invite a teammate', vars: [...BASE, 'link', 'inviter_name', 'role', 'expires_in'], requiresAny: ['link'], required: ['link'] },
  { key: 'admin_unlock_code', name: 'Admin unlock code', usedIn: 'Admin portal: setup and step-up code', vars: [...BASE, 'code', 'expires_in'], requiresAny: ['code'], required: ['code'] },
  { key: 'welcome', name: 'Welcome', usedIn: 'After the first sign-in', vars: BASE, requiresAny: [], required: [] },
]

export const CUSTOM_KEY_RE = /^[a-z][a-z0-9_]{1,47}$/

export function customScenario(key: string, name: string, description: string): EmailScenario {
  return { key, name, usedIn: description || 'Custom scenario', vars: EMAIL_VARIABLE_KEYS, requiresAny: [], required: [], custom: true }
}

export function builtinScenario(key: string): EmailScenario | undefined {
  return BUILTIN_SCENARIOS.find((s) => s.key === key)
}

/** The language a person reads email in: their saved preference when we have it, English otherwise. */
export function chooseLocale(preferred: unknown): EmailLocale {
  return preferred === 'ar' ? 'ar' : 'en'
}
