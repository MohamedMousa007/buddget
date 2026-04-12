'use client'

import { Loader2, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClass, inputFocus, inputStyle } from '@/components/features/auth-modal/authModalTokens'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'
import { useT } from '@/lib/i18n'

export interface AuthForgotStepProps {
  email: string
  onEmailChange: (v: string) => void
  loading: boolean
  forgotSuccess: boolean
  onSendReset: () => void
  onBackToSignIn: () => void
}

/**
 * Password reset request step (email + send link).
 */
export function AuthForgotStep({
  email,
  onEmailChange,
  loading,
  forgotSuccess,
  onSendReset,
  onBackToSignIn,
}: AuthForgotStepProps) {
  const t = useT()
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-brand-text-primary)] text-center">{t.auth.forgotTitle}</h2>
      {forgotSuccess ? (
        <p className="text-sm text-center text-[var(--color-brand-text-muted)]">{t.auth.forgotSuccess}</p>
      ) : (
        <>
          <div>
            <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.auth.forgotLabelEmail}</label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className={cn(inputClass, inputFocus, 'ps-10')}
                style={inputStyle}
                placeholder={t.auth.placeholderEmail}
              />
            </div>
          </div>
          <AuthPrimaryButton disabled={loading} onClick={() => void onSendReset()}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.auth.forgotSendLink}
          </AuthPrimaryButton>
        </>
      )}
      <button type="button" onClick={onBackToSignIn} className="w-full text-sm text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]">
        {t.auth.forgotBackToSignIn}
      </button>
    </div>
  )
}
