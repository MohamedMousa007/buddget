'use client'

import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAuthModal } from '@/hooks/useAuthModal'
import { useT } from '@/lib/i18n'
import { cardStyle } from '@/components/features/auth-modal/authModalTokens'
import { AuthModalBody } from '@/components/features/auth-modal/AuthModalBody'
import { useDismissable } from '@/hooks/useDismissable'
import { Scrim } from '@/components/ui/Scrim'
import { IconButton } from '@/components/ui/IconButton'

/**
 * Global Supabase auth overlay used for contextual prompts from inside the
 * app (e.g. "sign in to add an expense"). On the landing page the same
 * content renders inline — see `AuthModalBody`.
 */
export function AuthModal() {
  const a = useAuthModal()
  const t = useT()
  // Mounted only while open (AuthProvider gates it), so `true` is the open state.
  // Not on ModalShell because this is a scrollable CENTRED modal — ModalShell's
  // scroll lock plus bottom-sheet drag would fight the tall sign-up form on a
  // short viewport. It still needs Android back and Escape.
  useDismissable(true, () => a.closeAuthModal())

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto flex items-start sm:items-center justify-center p-4"
      role="presentation"
    >
      <Scrim
        label={t.auth.closeSignIn}
        onClick={() => a.closeAuthModal()}
        tone="light"
        className="transition-colors hover:bg-black/35"
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-10 w-full my-4 sm:my-0 border p-5 sm:p-6 shadow-2xl"
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          onClick={() => a.closeAuthModal()}
          aria-label={t.common.close}
          className="absolute end-3 top-3"
        >
          <X />
        </IconButton>
        <AuthModalBody />
      </motion.div>
    </div>
  )
}
