'use client'

import { Loader2 } from 'lucide-react'
import { AuthOtpRow } from '@/components/features/auth-modal/AuthOtpRow'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'

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
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">Check your inbox 📬</h2>
        <p className="text-sm text-[#5A5A72] mt-1">
          We sent a 6-digit code to <span className="text-white">{email}</span>
        </p>
      </div>
      <AuthOtpRow value={otp} onChange={onOtpChange} disabled={loading} />
      <AuthPrimaryButton disabled={loading} onClick={() => void onVerify()}>
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Verifying…</span>
          </>
        ) : (
          'Confirm & get started'
        )}
      </AuthPrimaryButton>
      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          disabled={resendCooldown > 0 || loading}
          onClick={() => void onResend()}
          className="text-[#E50914] disabled:opacity-50 disabled:cursor-not-allowed hover:underline"
        >
          {resendCooldown > 0 ? `Send a new code (${resendCooldown}s)` : 'Send a new code'}
        </button>
        <button type="button" onClick={onUseDifferentEmail} className="text-[#5A5A72] hover:text-white">
          Use a different email
        </button>
      </div>
    </div>
  )
}
