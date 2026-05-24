'use client'

import { useEffect } from 'react'
import { Mic, X, Check, Loader2, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { ModalShell } from '@/components/modals/ModalShell'
import { useVoiceExpense } from '@/hooks/useVoiceExpense'
import { isNative } from '@/lib/native/isNative'

interface VoiceRecordSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * WhatsApp-style bottom sheet that walks the user through the four states of
 * the voice → expense pipeline (idle / recording / processing / confirming /
 * error). Auto-starts recording when opened and posts to `/api/voice/transcribe`
 * + Gemini extraction on stop.
 */
export function VoiceRecordSheet({ open, onClose }: VoiceRecordSheetProps) {
  const { state, draft, transcript, error, start, stop, cancel, confirm, reset } = useVoiceExpense()

  useEffect(() => {
    if (!open) return
    if (state !== 'idle') return
    void start()
  }, [open, state, start])

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  const handleCancel = async () => {
    await cancel()
    onClose()
  }

  return (
    <ModalShell
      open={open}
      onBackdropClick={() => void handleCancel()}
      dragToClose
      panelClassName="!max-h-[min(70vh,540px)]"
    >
      <div className="flex flex-col items-center gap-4 pb-2">
        {state === 'error' ? <ErrorView error={error} onRetry={reset} onClose={() => void handleCancel()} /> : null}

        {state === 'idle' || state === 'recording' ? (
          <RecordingView state={state} onStop={() => void stop()} onCancel={() => void handleCancel()} />
        ) : null}

        {state === 'processing' ? <ProcessingView /> : null}

        {state === 'confirming' && draft ? (
          <ConfirmView
            description={draft.description}
            amount={draft.amount}
            currency={draft.currency}
            category={draft.category}
            confidence={draft.confidence}
            transcript={transcript}
            onConfirm={() => {
              confirm()
              onClose()
            }}
            onRedo={() => {
              reset()
              void start()
            }}
            onCancel={() => void handleCancel()}
          />
        ) : null}
      </div>
    </ModalShell>
  )
}

function RecordingView({
  state,
  onStop,
  onCancel,
}: {
  state: 'idle' | 'recording'
  onStop: () => void
  onCancel: () => void
}) {
  const isRecording = state === 'recording'
  return (
    <>
      <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
        {isRecording ? 'Listening… speak your expense.' : 'Getting ready…'}
      </p>
      <div className="relative my-3 flex items-center justify-center">
        <motion.div
          aria-hidden
          animate={isRecording ? { scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={isRecording ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
          className="absolute inset-0 -m-6 rounded-full bg-[var(--color-brand-red)]/20 blur-2xl"
        />
        <button
          type="button"
          onClick={onStop}
          disabled={!isRecording}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-brand-red)] text-white shadow-2xl shadow-red-900/40 transition-transform active:scale-95 disabled:opacity-50"
          aria-label="Stop and transcribe"
        >
          <Mic className="h-9 w-9" />
        </button>
      </div>
      <p className="text-center text-xs text-[var(--color-brand-text-muted)] max-w-[260px]">
        Try “200 جنيه taxi to office”, “spent 90 EGP at Talabat”, or “120 dirhams Carrefour”.
        {!isNative() ? ' (Microphone access required.)' : ''}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
      >
        <X className="h-4 w-4" /> Cancel
      </button>
    </>
  )
}

function ProcessingView() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-red)]" />
      <p className="text-sm text-[var(--color-brand-text-secondary)]">Reading the transcript…</p>
    </div>
  )
}

function ConfirmView({
  description,
  amount,
  currency,
  category,
  confidence,
  transcript,
  onConfirm,
  onRedo,
  onCancel,
}: {
  description: string
  amount: number
  currency: string
  category: string
  confidence: number
  transcript: string | null
  onConfirm: () => void
  onRedo: () => void
  onCancel: () => void
}) {
  return (
    <div className="w-full">
      <h3 className="text-base font-semibold text-[var(--color-brand-text-primary)]">
        Looks like an expense
      </h3>
      <p className="mt-1 text-xs text-[var(--color-brand-text-muted)]">
        AI confidence: {Math.round(confidence * 100)}%
      </p>

      <div className="mt-4 space-y-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4">
        <Row label="Amount" value={`${amount.toLocaleString()} ${currency}`} />
        <Row label="Description" value={description} />
        <Row label="Category" value={category} />
      </div>

      {transcript ? (
        <p className="mt-3 text-xs italic text-[var(--color-brand-text-muted)]">“{transcript}”</p>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <Check className="h-4 w-4" />
          Save expense
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          Redo
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-2.5 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-brand-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-brand-text-primary)]">{value}</span>
    </div>
  )
}

function ErrorView({
  error,
  onRetry,
  onClose,
}: {
  error: string | null
  onRetry: () => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <AlertTriangle className="h-8 w-8 text-[var(--color-brand-amber)]" />
      <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">
        Couldn&apos;t capture that
      </p>
      <p className="text-xs text-[var(--color-brand-text-muted)] max-w-[280px]">
        {error ?? 'Something went wrong. Try again or close.'}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-2 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        >
          Close
        </button>
      </div>
    </div>
  )
}
