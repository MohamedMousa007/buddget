'use client'

import { Lock, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClass, inputFocus, inputStyle } from '@/components/features/auth-modal/authModalTokens'
import type { AuthFormMode } from '@/hooks/useAuthModal'

export interface AuthCredentialFieldsProps {
  formMode: AuthFormMode
  email: string
  password: string
  confirmPassword: string
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onConfirmPasswordChange: (v: string) => void
  onForgotClick: () => void
  onSubmitPrimary: () => void
}

/**
 * Email, password, optional confirm, and forgot link for sign-in/up form step.
 */
export function AuthCredentialFields({
  formMode,
  email,
  password,
  confirmPassword,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onForgotClick,
  onSubmitPrimary,
}: AuthCredentialFieldsProps) {
  return (
    <div className="space-y-3">
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
      <div>
        <label className="text-xs text-[#5A5A72] mb-1 block">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
          <input
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void onSubmitPrimary()}
            className={cn(inputClass, inputFocus, 'pl-10')}
            style={inputStyle}
            placeholder="••••••••"
          />
        </div>
        {formMode === 'signin' ? (
          <button type="button" onClick={onForgotClick} className="mt-2 text-xs text-[#E50914] hover:underline">
            Forgot password?
          </button>
        ) : null}
      </div>
      {formMode === 'signup' ? (
        <div>
          <label className="text-xs text-[#5A5A72] mb-1 block">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onSubmitPrimary()}
              className={cn(inputClass, inputFocus, 'pl-10')}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
