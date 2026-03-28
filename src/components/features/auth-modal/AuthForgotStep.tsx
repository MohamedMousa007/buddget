'use client'

import { Loader2, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClass, inputFocus, inputStyle } from '@/components/features/auth-modal/authModalTokens'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'

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
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white text-center">Reset password</h2>
      {forgotSuccess ? (
        <p className="text-sm text-center text-[#5A5A72]">Reset link sent — check your email</p>
      ) : (
        <>
          <div>
            <label className="text-xs text-[#5A5A72] mb-1 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className={cn(inputClass, inputFocus, 'pl-10')}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>
          </div>
          <AuthPrimaryButton disabled={loading} onClick={() => void onSendReset()}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
          </AuthPrimaryButton>
        </>
      )}
      <button type="button" onClick={onBackToSignIn} className="w-full text-sm text-[#5A5A72] hover:text-white">
        Back to sign in
      </button>
    </div>
  )
}
