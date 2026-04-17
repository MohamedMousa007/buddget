'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAuthModal } from '@/hooks/useAuthModal'
import { AuthModalBranding } from '@/components/features/auth-modal/AuthModalBranding'
import { AuthForgotStep } from '@/components/features/auth-modal/AuthForgotStep'
import { AuthVerifyStep } from '@/components/features/auth-modal/AuthVerifyStep'
import { AuthSignInUpStep } from '@/components/features/auth-modal/AuthSignInUpStep'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

/**
 * The inner content of the auth surface — branding + step switching + language
 * toggle. Used by both `AuthModal` (wrapped in a fixed overlay) and the landing
 * page (rendered inline without any overlay chrome).
 *
 * `showBranding` controls the "Buddget" logo row. Set false on the landing
 * page where a bigger logo sits above the form.
 *
 * Every bit of auth state lives in the shared `useAuthModal` hook so the two
 * render sites are always in sync on form state, OTP step, etc.
 */
export function AuthModalBody({ showBranding = true }: { showBranding?: boolean }) {
  const a = useAuthModal()

  return (
    <>
      {showBranding ? <AuthModalBranding message={a.authModalMessage} /> : null}

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
              signinEmailCheckState={a.signinEmailCheckState}
              checkEmailOnBlur={a.checkEmailOnBlur}
              rememberMe={a.rememberMe}
              setRememberMe={a.setRememberMe}
              onResendPendingCode={() => {
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
    </>
  )
}
