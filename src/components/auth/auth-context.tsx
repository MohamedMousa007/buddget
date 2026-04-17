'use client'

import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  pendingNext: string
  setPendingNext: (path: string) => void
  /** Optional message shown above the sign-in form (e.g. “Sign in to add an expense”). */
  authModalMessage: string | null
  /** Which tab the modal should open on ('signin' by default). Callers override via `openAuthModal`. */
  authModalInitialMode: 'signin' | 'signup'
  openAuthModal: (next?: string, message?: string | null, initialMode?: 'signin' | 'signup') => void
  closeAuthModal: () => void
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
