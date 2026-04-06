'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InviteMemberSheetLabels {
  title: string
  email: string
  emailPlaceholder: string
  roleView: string
  roleManage: string
  syncLabel: string
  syncHelp: string
  send: string
  notFoundHint: string
  inviteApp: string
  foundAs: string
  close: string
}

export interface InviteMemberSheetProps {
  open: boolean
  onClose: () => void
  planId: string
  labels: InviteMemberSheetLabels
  onInviteSent: () => void
}

/**
 * Sheet to invite a partner by email with view/manage + optional transaction sync.
 */
export function InviteMemberSheet({
  open,
  onClose,
  planId,
  labels,
  onInviteSent,
}: InviteMemberSheetProps) {
  const [email, setEmail] = useState('')
  const [debounced, setDebounced] = useState('')
  const [lookup, setLookup] = useState<{ found: boolean; displayName?: string } | null>(null)
  const [role, setRole] = useState<'viewer' | 'manager'>('viewer')
  const [sync, setSync] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(email.trim()), 420)
    return () => clearTimeout(t)
  }, [email])

  useEffect(() => {
    if (!debounced || !debounced.includes('@')) {
      setLookup(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch('/api/budget/lookup-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: debounced }),
        })
        const data = (await res.json()) as { found?: boolean; displayName?: string }
        if (!cancelled) setLookup({ found: Boolean(data.found), displayName: data.displayName })
      } catch {
        if (!cancelled) setLookup(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced])

  const send = useCallback(async () => {
    if (!email.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/budget/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          email: email.trim(),
          role,
          syncTransactions: role === 'manager' ? sync : false,
        }),
      })
      if (res.ok) {
        onInviteSent()
        onClose()
        setEmail('')
      }
    } finally {
      setSending(false)
    }
  }, [email, planId, role, sync, onClose, onInviteSent])

  return (
    <AnimatePresence>
      {open ?
        <>
          <motion.button
            type="button"
            aria-label={labels.close}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 pb-safe sm:inset-auto sm:end-4 sm:top-24 sm:w-full sm:max-w-md sm:rounded-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg p-2 text-[var(--color-brand-text-muted)] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-xs text-[var(--color-brand-text-muted)] mb-1">{labels.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={labels.emailPlaceholder}
              className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2.5 text-sm text-white mb-3"
              autoComplete="email"
            />
            {loading ?
              <p className="text-xs text-[var(--color-brand-text-muted)] mb-3">{labels.foundAs}…</p>
            : lookup?.found ?
              <p className="text-xs text-[var(--color-brand-text-muted)] mb-3">
                {labels.foundAs}: <span className="text-white font-medium">{lookup.displayName}</span>
              </p>
            : debounced.includes('@') && lookup && !lookup.found ?
              <p className="text-xs text-amber-200/90 mb-3">{labels.notFoundHint}</p>
            : null}

            <div className="space-y-2 mb-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                <input
                  type="radio"
                  className="cursor-pointer"
                  checked={role === 'viewer'}
                  onChange={() => setRole('viewer')}
                />
                {labels.roleView}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                <input
                  type="radio"
                  className="cursor-pointer"
                  checked={role === 'manager'}
                  onChange={() => setRole('manager')}
                />
                {labels.roleManage}
              </label>
            </div>

            {role === 'manager' ?
              <div className="mb-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    className="cursor-pointer rounded"
                    checked={sync}
                    onChange={(e) => setSync(e.target.checked)}
                  />
                  {labels.syncLabel}
                </label>
                <p className="mt-1 text-[11px] text-[var(--color-brand-text-muted)]">{labels.syncHelp}</p>
              </div>
            : null}

            <button
              type="button"
              disabled={sending || !email.trim()}
              onClick={() => void send()}
              className={cn(
                'w-full cursor-pointer rounded-xl py-3 text-sm font-semibold text-white transition-colors',
                sending || !email.trim() ? 'bg-[var(--color-brand-border)]' : 'bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)]'
              )}
            >
              {lookup && !lookup.found && debounced.includes('@') ? labels.inviteApp : labels.send}
            </button>
          </motion.div>
        </>
      : null}
    </AnimatePresence>
  )
}
