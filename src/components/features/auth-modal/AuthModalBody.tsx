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
                a.backToEmail()
                a.setOtp('')
                a.setError('')
              }}
            />
          ) : (
            <AuthSignInUpStep
              emailStep={a.emailStep}
              passwordIntent={a.passwordIntent}
              emailAdvancePending={a.emailAdvancePending}
              advanceAfterEmail={() => void a.advanceAfterEmail()}
              backToEmail={a.backToEmail}
              abandonVerifyPending={a.abandonVerifyPending}
              continueVerifyPending={() => void a.continueVerifyPending()}
              submitPassword={a.submitPassword}
              email={a.email}
              setEmail={a.setEmail}
              password={a.password}
              setPassword={a.setPassword}
              error={a.error}
              setError={a.setError}
              loading={a.loading}
              onForgotClick={() => {
                a.setStep('forgot')
                a.setForgotSuccess(false)
                a.setError('')
              }}
              resendCode={a.resendCode}
              rememberMe={a.rememberMe}
              setRememberMe={a.setRememberMe}
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
