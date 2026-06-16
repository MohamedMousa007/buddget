'use client'

import { useEffect, useRef, useCallback, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, type MotionValue } from 'framer-motion'
import { Check, X, RotateCcw, Loader2, Trash2 } from 'lucide-react'
import type { VoiceState } from '@/hooks/useVoiceExpense'
import type { ExtractedExpense } from '@/lib/ai/extractVoiceExpense'

const BARS = 36
const W = BARS * 5
const H = 36

interface Props {
  state: VoiceState
  amplitude: number
  animTime: number
  draft: ExtractedExpense | null
  error: string | null
  /** Live finger coordinates from the hold gesture — the widget follows these. */
  posX: MotionValue<number>
  posY: MotionValue<number>
  /** True while the finger is inside the trash drop-zone. */
  nearTrash: boolean
  /** Trash drop-zone element, owned by the gesture for proximity measurement. */
  trashRef: RefObject<HTMLDivElement | null>
  onCancel: () => void
  onConfirm: () => void
  onRedo: () => void
  onClose: () => void
}

export function VoiceRecordOverlay({
  state,
  amplitude,
  animTime,
  draft,
  error,
  posX,
  posY,
  nearTrash,
  trashRef,
  onCancel,
  onConfirm,
  onRedo,
  onClose,
}: Props) {
  const visible = state !== 'idle'

  // Portal to <body>: the overlay must escape the bottom-nav, whose backdrop-blur
  // establishes a containing block that re-anchors position:fixed children
  // (WebKit), which otherwise pushes the finger-tracked widget off-screen.
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {visible && state === 'recording' && (
        <FloatingRecordingWidget
          key="floating-recording"
          amplitude={amplitude}
          animTime={animTime}
          posX={posX}
          posY={posY}
          nearTrash={nearTrash}
          trashRef={trashRef}
        />
      )}
      {(state === 'processing' || state === 'error' || state === 'confirming') && (
        <motion.div
          key="voice-overlay"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed bottom-[72px] start-4 end-4 z-[60] rounded-2xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] shadow-2xl overflow-hidden"
        >
          {state === 'processing' && <ProcessingPanel onCancel={onCancel} />}
          {state === 'error' && (
            <ErrorPanel error={error} onRedo={onRedo} onClose={onClose} />
          )}
          {state === 'confirming' && draft && (
            <ConfirmPanel draft={draft} onConfirm={onConfirm} onRedo={onRedo} onClose={onClose} />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── Canvas waveform ──────────────────────────────────────────────────────────

function Waveform({ amplitude, animTime }: { amplitude: number; animTime: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const red =
      getComputedStyle(document.documentElement).getPropertyValue('--color-brand-red').trim() ||
      '#e12424'
    const t = animTime / 400
    const barW = W / BARS
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = red
    for (let i = 0; i < BARS; i++) {
      const env = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.6 + t))
      const h = Math.max(2, H * (0.1 + amplitude * 0.9 * env))
      const y = (H - h) / 2
      ctx.globalAlpha = 0.3 + 0.7 * Math.min(amplitude * env, 1)
      ctx.beginPath()
      ctx.roundRect(i * barW + 1, y, barW - 2, h, 1.5)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }, [amplitude, animTime])

  useEffect(() => { draw() }, [draw])

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{ width: W, height: H }}
      className="mx-auto"
    />
  )
}

// ── Floating recording widget (follows finger, drag-to-trash to cancel) ──────

function FloatingRecordingWidget({
  amplitude,
  animTime,
  posX,
  posY,
  nearTrash,
  trashRef,
}: {
  amplitude: number
  animTime: number
  posX: MotionValue<number>
  posY: MotionValue<number>
  nearTrash: boolean
  trashRef: RefObject<HTMLDivElement | null>
}) {
  const [startTs] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTs) / 1000)), 250)
    return () => clearInterval(id)
  }, [startTs])

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')

  return (
    <>
      {/* Trash drop-zone — fixed above the recording area; grows as the finger nears */}
      <div
        className="fixed z-[60] pointer-events-none"
        style={{ bottom: 'calc(190px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}
      >
        <motion.div
          ref={trashRef}
          animate={{ scale: nearTrash ? 1.45 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="w-14 h-14 rounded-full flex items-center justify-center border-2"
          style={{
            backgroundColor: nearTrash ? 'var(--color-brand-red)' : 'var(--color-brand-elevated)',
            borderColor: nearTrash ? 'var(--color-brand-red)' : 'var(--color-brand-border)',
          }}
        >
          <Trash2 className="h-6 w-6" style={{ color: nearTrash ? '#fff' : 'var(--color-brand-text-muted)' }} />
        </motion.div>
      </div>

      {/* Recording chip — its (left,top) origin tracks the finger via posX/posY,
          and the inner wrapper offsets it to sit just above the fingertip. */}
      <motion.div
        style={{ x: posX, y: posY, position: 'fixed', left: 0, top: 0, zIndex: 61, pointerEvents: 'none' }}
      >
        <div style={{ transform: 'translate(-50%, -165%)' }}>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: nearTrash ? 0.6 : 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="flex items-center gap-3 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] shadow-2xl rounded-2xl px-4 py-3"
          >
            {/* Pulsing red dot */}
            <motion.span
              animate={{ scale: [1, 1.25, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-red)] shrink-0"
            />

            {/* Waveform */}
            <div className="overflow-hidden">
              <Waveform amplitude={amplitude} animTime={animTime} />
            </div>

            {/* Timer */}
            <span className="text-xs font-mono text-[var(--color-brand-text-secondary)] shrink-0 w-10 text-end">
              {mins}:{secs}
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Hint text */}
      <div
        className="fixed z-[60] pointer-events-none flex justify-center start-0 end-0"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
      >
        <span className="text-xs text-[var(--color-brand-text-muted)] bg-[var(--color-brand-card)]/80 backdrop-blur px-3 py-1 rounded-full">
          {nearTrash ? 'Release to cancel' : 'Release to save · drag up to cancel'}
        </span>
      </div>
    </>
  )
}

// ── Processing panel ─────────────────────────────────────────────────────────

function ProcessingPanel({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-red)] shrink-0" />
        <span className="text-sm text-[var(--color-brand-text-secondary)]">Transcribing…</span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg p-1 text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        aria-label="Cancel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Error panel ──────────────────────────────────────────────────────────────

function ErrorPanel({
  error,
  onRedo,
  onClose,
}: {
  error: string | null
  onRedo: () => void
  onClose: () => void
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-xs text-[var(--color-brand-text-secondary)] min-w-0 truncate flex-1">
        {error ?? 'Something went wrong'}
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onRedo}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] px-2 py-1 text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]"
        >
          <RotateCcw className="h-3 w-3" /> Retry
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Confirm panel ─────────────────────────────────────────────────────────────

function ConfirmPanel({
  draft,
  onConfirm,
  onRedo,
  onClose,
}: {
  draft: ExtractedExpense
  onConfirm: () => void
  onRedo: () => void
  onClose: () => void
}) {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)] truncate">
            {draft.description}
          </p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            {draft.amount.toLocaleString()} {draft.currency} · {draft.category}
          </p>
        </div>
        <p className="text-[10px] text-[var(--color-brand-text-muted)] shrink-0 mt-0.5">
          {Math.round(draft.confidence * 100)}% confident
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <Check className="h-3.5 w-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          Redo
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-2 text-xs text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
