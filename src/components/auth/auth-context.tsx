'use client'

import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthMode = 'loading' | 'landing' | 'authenticated'

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  pendingNext: string
  setPendingNext: (path: string) => void
  /** Optional message shown above the sign-in form (e.g. "Sign in to add an expense"). */
  authModalMessage: string | null
  /** Which step the modal should open on ('form' by default). Callers override via `openAuthModal`. */
  authModalInitialStep: 'form' | 'forgot'
  /**
   * Open the global auth modal. The legacy `initialMode` parameter (signin|signup)
   * is accepted for call-site compatibility but ignored — the morph form is
   * email-first and no longer has separate tabs. `initialStep === 'forgot'`
   * still jumps straight into the forgot-password step.
   */
  openAuthModal: (
    next?: string,
    message?: string | null,
    initialMode?: 'signin' | 'signup',
    initialStep?: 'form' | 'forgot',
  ) => void
  closeAuthModal: () => void
  /**
   * 'loading'       — initial auth fetch in flight; no gate decision yet.
   * 'landing'       — unauthenticated. Landing page renders.
   * 'authenticated' — real Supabase user; standard app flow.
   */
  mode: AuthMode
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext) ?? null
}
