'use client'

import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAuthModal } from '@/hooks/useAuthModal'
import { useT } from '@/lib/i18n'
import { cardStyle } from '@/components/features/auth-modal/authModalTokens'
import { AuthModalBody } from '@/components/features/auth-modal/AuthModalBody'

/**
 * Global Supabase auth overlay used for contextual prompts from inside the
 * app (e.g. "sign in to add an expense"). On the landing page the same
 * content renders inline — see `AuthModalBody`.
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
        <AuthModalBody />
      </motion.div>
    </div>
  )
}
