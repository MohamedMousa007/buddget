'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

export interface AuthFormErrorAlertProps {
  error: string
  onSignInInstead: () => void
  onResendCode: () => void
}

/**
 * Inline auth error with optional recovery actions.
 */
export function AuthFormErrorAlert({ error, onSignInInstead, onResendCode }: AuthFormErrorAlertProps) {
  return (
    <AnimatePresence>
      {error ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-start gap-2 text-sm text-[#E50914]"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {error}
            {error.includes('Sign in instead?') ? (
              <>
                {' '}
                <button type="button" className="underline font-medium" onClick={onSignInInstead}>
                  Sign in instead
                </button>
              </>
            ) : null}
            {error.includes('Resend confirmation code?') ? (
              <>
                {' '}
                <button type="button" className="underline font-medium" onClick={() => void onResendCode()}>
                  Resend code
                </button>
              </>
            ) : null}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
