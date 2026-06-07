'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Mic, X, Check, Loader2, AlertTriangle } from 'lucide-react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { ModalShell } from '@/components/modals/ModalShell'
import { useVoiceExpense } from '@/hooks/useVoiceExpense'
import { isNative } from '@/lib/native/isNative'

interface VoiceRecordSheetProps {
  open: boolean
  onClose: () => void
}

export function VoiceRecordSheet({ open, onClose }: VoiceRecordSheetProps) {
  const { state, draft, transcript, error, amplitude, animTime, start, stop, cancel, confirm, reset } =
    useVoiceExpense()

  useEffect(() => {
    if (!open) reset()
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
        {state === 'error' ? (
          <ErrorView error={error} onRetry={reset} onClose={() => void handleCancel()} />
        ) : null}

        {state === 'idle' || state === 'recording' ? (
          <RecordingView
            state={state}
            amplitude={amplitude}
            animTime={animTime}
            onStart={() => void start()}
            onStop={() => void stop()}
            onCancel={() => void handleCancel()}
          />
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
            onConfirm={() => { confirm(); onClose() }}
            onRedo={() => { reset(); void start() }}
            onCancel={() => void handleCancel()}
          />
        ) : null}
      </div>
    </ModalShell>
  )
}

// ── Canvas Visualizer ────────────────────────────────────────────────────────

const BARS = 40
const CANVAS_W = BARS * 5
const CANVAS_H = 48

function Visualizer({ amplitude, animTime }: { amplitude: number; animTime: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Read CSS variable once per frame — handles dark/light mode switches
    const red = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand-red')
      .trim() || '#e12424'

    const t = animTime / 400
    const barW = CANVAS_W / BARS

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = red

    for (let i = 0; i < BARS; i++) {
      const envelope = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.6 + t))
      const h = Math.max(3, CANVAS_H * (0.08 + amplitude * 0.92 * envelope))
      const y = (CANVAS_H - h) / 2
      ctx.globalAlpha = 0.25 + 0.75 * Math.min(amplitude * envelope, 1)
      ctx.beginPath()
      ctx.roundRect(i * barW + 1, y, barW - 2, h, 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }, [amplitude, animTime])

  useEffect(() => { draw() }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ width: CANVAS_W, height: CANVAS_H }}
      className="mx-auto"
    />
  )
}

// ── Recording view — hold-to-record + slide-to-cancel ───────────────────────

function RecordingView({
  state,
  amplitude,
  animTime,
  onStart,
  onStop,
  onCancel,
}: {
  state: 'idle' | 'recording'
  amplitude: number
  animTime: number
  onStart: () => void
  onStop: () => void
  onCancel: () => void
}) {
  const isRecording = state === 'recording'
  const x = useMotionValue(0)
  // Hint fades from full opacity at rest to transparent when dragged -80px
  const hintOpacity = useTransform(x, [-80, 0], [0, 1])
  // Prevent stop() from firing if drag-to-cancel was triggered first
  const cancelledRef = useRef(false)
  // Set true on touchstart so touchend can fire stop() regardless of whether
  // React has flushed the state update from 'idle' → 'recording' yet.
  const touchActiveRef = useRef(false)

  return (
    <>
      <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
        {isRecording ? 'Listening… speak your expense.' : 'Hold mic to record'}
      </p>

      {isRecording ? <Visualizer amplitude={amplitude} animTime={animTime} /> : null}

      <div className="relative flex items-center justify-center gap-3 my-2">
        {/* Slide-to-cancel hint */}
        {isRecording ? (
          <motion.span
            style={{ opacity: hintOpacity }}
            className="text-xs text-[var(--color-brand-text-muted)] select-none pointer-events-none"
          >
            ← Slide to cancel
          </motion.span>
        ) : null}

        {/* Draggable mic button — touch-action:none prevents scroll hijack on Android */}
        <motion.div
          drag={isRecording ? 'x' : false}
          dragConstraints={{ left: -120, right: 0 }}
          dragElastic={0.1}
          style={{ x, touchAction: 'none' }}
          className="relative flex items-center justify-center"
          onTouchStart={(e) => {
            e.preventDefault() // bypass Android WebView's 300ms tap delay
            if (state !== 'idle' || touchActiveRef.current) return
            cancelledRef.current = false
            touchActiveRef.current = true
            void onStart()
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            // Use touchActiveRef (set synchronously) instead of isRecording
            // (React state) — prevents the race where the user releases before
            // setState('recording') has flushed but after start() was called.
            if (!touchActiveRef.current || cancelledRef.current) return
            touchActiveRef.current = false
            onStop()
          }}
          onPointerDown={(e) => {
            // Pointer fallback for desktop / non-touch environments
            if (e.pointerType === 'touch') return // already handled by onTouchStart
            if (state !== 'idle') return
            cancelledRef.current = false
            touchActiveRef.current = true
            void onStart()
          }}
          onPointerUp={(e) => {
            if (e.pointerType === 'touch') return
            if (!touchActiveRef.current || cancelledRef.current) return
            touchActiveRef.current = false
            onStop()
          }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -80) {
              cancelledRef.current = true
              touchActiveRef.current = false
              x.set(0)
              onCancel()
            } else {
              x.set(0)
            }
          }}
        >
          {/* Pulsing glow ring */}
          <motion.div
            aria-hidden
            animate={isRecording ? { scale: [1, 1.2, 1] } : { scale: 1 }}
            transition={
              isRecording
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0 }
            }
            className="absolute -inset-6 rounded-full bg-[var(--color-brand-red)]/20 blur-2xl"
          />
          <div
            className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-brand-red)] text-white shadow-2xl shadow-red-900/40 select-none"
            aria-label={isRecording ? 'Release to transcribe' : 'Hold to record'}
          >
            <Mic className="h-9 w-9 pointer-events-none" />
          </div>
        </motion.div>
      </div>

      <p className="text-center text-xs text-[var(--color-brand-text-muted)] max-w-[260px]">
        {isRecording
          ? 'Release to transcribe · Slide left to cancel'
          : 'Try "200 جنيه taxi", "90 EGP Talabat", or "120 dirhams Carrefour".' +
            (!isNative() ? ' (Microphone access required.)' : '')}
      </p>

      {!isRecording ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      ) : null}
    </>
  )
}

// ── Processing ──────────────────────────────────────────────────────────────

function ProcessingView() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-red)]" />
      <p className="text-sm text-[var(--color-brand-text-secondary)]">Reading the transcript…</p>
    </div>
  )
}

// ── Confirm ─────────────────────────────────────────────────────────────────

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
        <p className="mt-3 text-xs italic text-[var(--color-brand-text-muted)]">&ldquo;{transcript}&rdquo;</p>
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

// ── Error ────────────────────────────────────────────────────────────────────

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
