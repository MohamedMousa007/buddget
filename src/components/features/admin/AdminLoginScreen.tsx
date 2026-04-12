'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Lock } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'

export interface AdminLoginScreenProps {
  pin: string
  onPinChange: (v: string) => void
  error: string
  loading: boolean
  onLogin: () => void
}

/**
 * PIN gate before the authenticated admin dashboard.
 */
export function AdminLoginScreen({ pin, onPinChange, error, loading, onLogin }: AdminLoginScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-elevated)] flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-[var(--color-brand-red)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">Admin Panel</h1>
          <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">Enter your admin PIN to continue</p>
        </div>

        <div className="space-y-4">
          <Input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => onPinChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onLogin()}
            className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-center text-2xl tracking-[0.5em] font-mono-numbers placeholder:text-[var(--color-brand-text-muted)] placeholder:tracking-normal placeholder:text-sm"
            autoFocus
          />

          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-[var(--color-brand-red)] text-center"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <button
            type="button"
            onClick={onLogin}
            disabled={!pin.trim() || loading}
            className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {loading ? 'Verifying...' : 'Unlock'}
          </button>

          <Link
            href="/"
            className="block text-center text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
