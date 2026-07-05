'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, RefreshCw } from 'lucide-react'
import { flushFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Force-push the local store to Supabase. Hidden until the user actually
 * changes a setting (`dirty`); on save it becomes a non-clickable "Saved"
 * confirmation for a beat, then hides again. No toast.
 */
export function SettingsSaveButton({ dirty, onSaved }: { dirty: boolean; onSaved?: () => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const onSave = async () => {
    if (busy) return
    setBusy(true)
    try {
      await flushFinanceNow()
      onSaved?.() // resets the parent's dirty snapshot → `dirty` flips false
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 1500)
    } catch {
      // flush is best-effort; the next auto-flush retries. Stay in the Save state.
    } finally {
      setBusy(false)
    }
  }

  const visible = (dirty && !justSaved) || justSaved || busy

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          onClick={justSaved ? undefined : onSave}
          disabled={justSaved || busy}
          aria-label={justSaved ? t.common.saved : t.common.save}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={cn(
            'flex h-11 min-w-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors',
            justSaved
              ? 'bg-[var(--color-brand-green)] text-white'
              : 'bg-[var(--color-brand-red)] text-white hover:bg-[var(--color-brand-red-hover)] active:scale-95 disabled:opacity-60',
          )}
        >
          {justSaved ? (
            <Check className="h-4 w-4" />
          ) : busy ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : null}
          <span>{justSaved ? t.common.saved : t.common.save}</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  )
}
