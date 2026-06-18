'use client'

import { Loader2 } from 'lucide-react'
import { AuthOtpRow } from '@/components/features/auth-modal/AuthOtpRow'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'
import { useT } from '@/lib/i18n'
import type { AuthVerifyPurpose } from '@/hooks/useAuthModal'

export interface AuthVerifyStepProps {
  email: string
  otp: string
  onOtpChange: (v: string) => void
  loading: boolean
  resendCooldown: number
  purpose?: AuthVerifyPurpose
  onVerify: () => void
  onResend: () => void
  onUseDifferentEmail: () => void
}

/**
 * Shared email-OTP screen. Used for post-signup email confirmation, the 2FA
 * challenge on a new device, and the in-app password-reset recovery code.
 */
export function AuthVerifyStep({
  email,
  otp,
  onOtpChange,
  loading,
  resendCooldown,
  purpose = 'signup',
  onVerify,
  onResend,
  onUseDifferentEmail,
}: AuthVerifyStepProps) {
  const t = useT()
  const is2fa = purpose === '2fa'
  const isRecovery = purpose === 'recovery'
  const title = isRecovery ? t.auth.recoveryVerifyTitle : is2fa ? t.auth.twoFaVerifyTitle : t.auth.verifyTitle
  const subtitle = isRecovery
    ? t.auth.recoveryCodeSent(email)
    : is2fa
      ? t.auth.twoFaCodeSent(email)
      : t.auth.verifyCodeSent(email)
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{title}</h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">{subtitle}</p>
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
