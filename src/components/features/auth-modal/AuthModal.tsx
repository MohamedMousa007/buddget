'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useAuthModal } from '@/hooks/useAuthModal'
import { useT } from '@/lib/i18n'
import { cardStyle } from '@/components/features/auth-modal/authModalTokens'
import { AuthModalBranding } from '@/components/features/auth-modal/AuthModalBranding'
import { AuthForgotStep } from '@/components/features/auth-modal/AuthForgotStep'
import { AuthVerifyStep } from '@/components/features/auth-modal/AuthVerifyStep'
import { AuthSignInUpStep } from '@/components/features/auth-modal/AuthSignInUpStep'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

/**
 * Global Supabase auth overlay; logic in `useAuthModal`.
 */
export function AuthModal() {
  const a = useAuthModal()
  const t = useT()

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto flex items-start sm:items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/25 backdrop-blur-md transition-colors hover:bg-black/35"
        aria-label={t.auth.closeSignIn}
        onClick={() => a.closeAuthModal()}
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-10 w-full my-4 sm:my-0 border p-6 sm:p-8 shadow-2xl"
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => a.closeAuthModal()}
          className="absolute end-3 top-3 rounded-lg p-2 text-[var(--color-brand-text-muted)] transition-colors hover:bg-[var(--color-brand-text-primary)]/5 hover:text-[var(--color-brand-text-primary)]"
          aria-label={t.common.close}
        >
          <X className="h-5 w-5" />
        </button>
        <AuthModalBranding message={a.authModalMessage} />

        <AnimatePresence mode="wait">
          <motion.div
            key={a.contentKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {a.step === 'forgot' ? (
              <AuthForgotStep
                email={a.email}
                onEmailChange={a.setEmail}
                loading={a.loading}
                forgotSuccess={a.forgotSuccess}
                onSendReset={() => void a.sendForgot()}
                onBackToSignIn={() => {
                  a.setStep('form')
                  a.setForgotSuccess(false)
                  a.setError('')
                }}
              />
            ) : a.step === 'verify' ? (
              <AuthVerifyStep
                email={a.email}
                otp={a.otp}
                onOtpChange={a.setOtp}
                loading={a.loading}
                resendCooldown={a.resendCooldown}
                purpose={a.verifyPurpose}
                onVerify={() => void a.verifySignupOtp()}
                onResend={() => void a.resendCode()}
                onUseDifferentEmail={() => {
                  a.setStep('form')
                  a.setFormMode(a.verifyPurpose === '2fa' ? 'signin' : 'signup')
                  a.setOtp('')
                  a.setError('')
                }}
              />
            ) : (
              <AuthSignInUpStep
                formMode={a.formMode}
                setFormMode={a.setFormMode}
                email={a.email}
                setEmail={a.setEmail}
                password={a.password}
                setPassword={a.setPassword}
                confirmPassword={a.confirmPassword}
                setConfirmPassword={a.setConfirmPassword}
                error={a.error}
                setError={a.setError}
                loading={a.loading}
                setStep={a.setStep}
                setForgotSuccess={a.setForgotSuccess}
                signIn={a.signIn}
                signUp={a.signUp}
                resendCode={a.resendCode}
                switchToSignIn={a.switchToSignIn}
                emailCheckState={a.emailCheckState}
                checkEmailOnBlur={a.checkEmailOnBlur}
                rememberMe={a.rememberMe}
                setRememberMe={a.setRememberMe}
                onResendPendingCode={() => {
                  // Treat as re-verification: pop the user into the verify step
                  // for this email. Supabase's signup OTP flow already wants
                  // verifyPurpose='signup'; kick it by setting state + resending.
                  a.setStep('verify')
                  a.setOtp('')
                  void a.resendCode()
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center mt-4">
          <LanguageToggle size="sm" />
        </div>
      </motion.div>
    </div>
  )
}
