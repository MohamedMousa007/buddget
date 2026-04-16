'use client'

import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { AuthFormMode } from '@/hooks/useAuthModal'

export interface AuthModeToggleProps {
  formMode: AuthFormMode
  onModeChange: (m: AuthFormMode) => void
  onClearError: () => void
}

/**
 * Sign in vs Sign up segmented control.
 */
export function AuthModeToggle({ formMode, onModeChange, onClearError }: AuthModeToggleProps) {
  const t = useT()
  return (
    <div className="flex rounded-xl border p-1" style={{ background: 'var(--color-brand-elevated)', borderColor: 'var(--color-brand-border)' }}>
      <button
        type="button"
        onClick={() => {
          onModeChange('signin')
          onClearError()
        }}
        className={cn(
          'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
          formMode === 'signin' ? 'text-white' : 'text-[var(--color-brand-text-muted)]'
        )}
        style={formMode === 'signin' ? { background: 'var(--color-brand-red)' } : {}}
      >
        {t.auth.signInLabel}
      </button>
      <button
        type="button"
        onClick={() => {
          onModeChange('signup')
          onClearError()
        }}
        className={cn(
          'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
          formMode === 'signup' ? 'text-white' : 'text-[var(--color-brand-text-muted)]'
        )}
        style={formMode === 'signup' ? { background: 'var(--color-brand-red)' } : {}}
      >
        {t.auth.signUpLabel}
      </button>
    </div>
  )
}
