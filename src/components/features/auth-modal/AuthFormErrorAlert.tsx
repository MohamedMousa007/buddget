'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface AuthFormErrorAlertProps {
  error: string
  onSignInInstead?: () => void
  onResendCode: () => void
}

/**
 * Inline auth error with optional recovery actions.
 */
export function AuthFormErrorAlert({ error, onSignInInstead, onResendCode }: AuthFormErrorAlertProps) {
  const t = useT()
  return (
    <AnimatePresence>
      {error ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-start justify-center gap-1.5 text-center text-xs leading-snug text-[#FF8A6B]"
        >
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            {error}
            {error === t.auth.errorAccountExists && onSignInInstead ? (
              <>
                {' '}
                <button type="button" className="underline font-medium" onClick={onSignInInstead}>
                  {t.auth.signInInstead}
                </button>
              </>
            ) : null}
            {error === t.auth.errorUnconfirmed ? (
              <>
                {' '}
                <button type="button" className="underline font-medium" onClick={() => void onResendCode()}>
                  {t.auth.sendNewCode}
                </button>
              </>
            ) : null}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
