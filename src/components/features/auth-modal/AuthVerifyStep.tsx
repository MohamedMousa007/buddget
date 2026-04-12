'use client'

import { Loader2 } from 'lucide-react'
import { AuthOtpRow } from '@/components/features/auth-modal/AuthOtpRow'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'
import { useT } from '@/lib/i18n'

export interface AuthVerifyStepProps {
  email: string
  otp: string
  onOtpChange: (v: string) => void
  loading: boolean
  resendCooldown: number
  onVerify: () => void
  onResend: () => void
  onUseDifferentEmail: () => void
}

/**
 * Post-signup email OTP verification.
 */
export function AuthVerifyStep({
  email,
  otp,
  onOtpChange,
  loading,
  resendCooldown,
  onVerify,
  onResend,
  onUseDifferentEmail,
}: AuthVerifyStepProps) {
  const t = useT()
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{t.auth.verifyTitle}</h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
          {t.auth.verifyCodeSent(email)}
        </p>
      </div>
      <AuthOtpRow value={otp} onChange={onOtpChange} disabled={loading} />
      <AuthPrimaryButton disabled={loading} onClick={() => void onVerify()}>
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t.auth.verifying}</span>
          </>
        ) : (
          t.auth.verifyConfirm
        )}
      </AuthPrimaryButton>
      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          disabled={resendCooldown > 0 || loading}
          onClick={() => void onResend()}
          className="text-[var(--color-brand-red)] disabled:opacity-50 disabled:cursor-not-allowed hover:underline"
        >
          {resendCooldown > 0 ? t.auth.verifySendNewCooldown(resendCooldown) : t.auth.verifySendNew}
        </button>
        <button type="button" onClick={onUseDifferentEmail} className="text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]">
          {t.auth.verifyDifferentEmail}
        </button>
      </div>
    </div>
  )
}
