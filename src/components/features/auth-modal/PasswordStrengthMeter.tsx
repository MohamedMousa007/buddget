'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { MIN_PASSWORD_LEN } from '@/components/features/auth-modal/authModalTokens'

export interface PasswordStrengthMeterProps {
  password: string
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-[11px]">
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-brand-green)] shrink-0" aria-hidden />
      ) : (
        <Circle className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)] shrink-0" aria-hidden />
      )}
      <span className={ok ? 'text-[var(--color-brand-text-secondary)]' : 'text-[var(--color-brand-text-muted)]'}>
        {label}
      </span>
    </li>
  )
}

/**
 * Signup-only: live score (0–4) + checklist of the hard rules we enforce at submit
 * time (length ≥ 8, at least one letter, at least one number). Purely informational;
 * the real gate lives in `useAuthModal.signUp`.
 */
export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const t = useT()
  const hasLength = password.length >= MIN_PASSWORD_LEN
  const hasLetter = /[A-Za-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const isLong = password.length >= 12

  // 0 empty · 1 weak (missing a rule) · 2 fair (rules met) · 3 good (+symbol OR long)
  // · 4 strong (+symbol AND long). Cascading ladder — first match wins.
  const passesRules = hasLength && hasLetter && hasNumber
  let score = 0
  if (password.length === 0) score = 0
  else if (!passesRules) score = 1
  else if (passesRules && hasSymbol && isLong) score = 4
  else if (passesRules && (hasSymbol || isLong)) score = 3
  else score = 2

  const labels = [
    '',
    t.auth.passwordStrengthWeak,
    t.auth.passwordStrengthFair,
    t.auth.passwordStrengthGood,
    t.auth.passwordStrengthStrong,
  ]
  const colors = [
    'bg-[var(--color-brand-border)]',
    'bg-[var(--color-brand-red)]',
    'bg-[var(--color-brand-amber)]',
    'bg-[var(--color-brand-gold)]',
    'bg-[var(--color-brand-green)]',
  ]

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={
                'h-0.5 flex-1 rounded-full transition-colors ' +
                (i <= score ? colors[score] : 'bg-[var(--color-brand-border)]')
              }
            />
          ))}
        </div>
        <span className="text-[11px] font-medium text-[var(--color-brand-text-muted)] min-w-[44px] text-end">
          {password.length === 0 ? t.auth.passwordStrengthLabel : labels[score]}
        </span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4">
        <Rule ok={hasLength} label={t.auth.passwordRuleLength(MIN_PASSWORD_LEN)} />
        <Rule ok={hasLetter} label={t.auth.passwordRuleLetter} />
        <Rule ok={hasNumber} label={t.auth.passwordRuleNumber} />
      </ul>
    </div>
  )
}
