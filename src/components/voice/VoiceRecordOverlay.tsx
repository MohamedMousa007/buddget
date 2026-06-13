'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, useMotionValue, AnimatePresence } from 'framer-motion'
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
  onStop: () => void
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
  onStop,
  onCancel,
  onConfirm,
  onRedo,
  onClose,
}: Props) {
  const visible = state !== 'idle'

  return (
    <AnimatePresence>
      {visible && state === 'recording' && (
        <FloatingRecordingWidget
          key="floating-recording"
          amplitude={amplitude}
          animTime={animTime}
          onStop={onStop}
          onCancel={onCancel}
        />
      )}
      {visible && state !== 'recording' && (
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
    </AnimatePresence>
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

// ── Floating recording widget (draggable, trash-to-cancel) ──────────────────

const TRASH_PROXIMITY = 72 // px — distance to trigger trash animation

function FloatingRecordingWidget({
  amplitude,
  animTime,
  onStop,
  onCancel,
}: {
  amplitude: number
  animTime: number
  onStop: () => void
  onCancel: () => void
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const [nearTrash, setNearTrash] = useState(false)
  const [cancelFired, setCancelFired] = useState(false)
  const trashRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const [startTs] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTs) / 1000)), 250)
    return () => clearInterval(id)
  }, [startTs])

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')

  const checkProximity = useCallback(() => {
    const trash = trashRef.current
    const chip = chipRef.current
    if (!trash || !chip) return
    const tr = trash.getBoundingClientRect()
    const cr = chip.getBoundingClientRect()
    const dist = Math.hypot(
      cr.left + cr.width / 2 - (tr.left + tr.width / 2),
      cr.top + cr.height / 2 - (tr.top + tr.height / 2),
    )
    setNearTrash(dist < TRASH_PROXIMITY)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (nearTrash && !cancelFired) {
      setCancelFired(true)
      onCancel()
    } else {
      // Spring back to original position
      x.set(0)
      y.set(0)
      setNearTrash(false)
    }
  }, [nearTrash, cancelFired, onCancel, x, y])

  return (
    <>
      {/* Trash zone — fixed above the chip's resting position */}
      <div
        className="fixed z-[60] pointer-events-none"
        style={{ bottom: '164px', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}
      >
        <motion.div
          ref={trashRef}
          animate={{
            scale: nearTrash ? 1.4 : 1,
            transition: { type: 'spring', stiffness: 400, damping: 20 },
          }}
          className="w-12 h-12 rounded-full flex items-center justify-center border-2"
          style={{
            backgroundColor: nearTrash
              ? 'var(--color-brand-red)'
              : 'var(--color-brand-elevated)',
            borderColor: nearTrash ? 'var(--color-brand-red)' : 'var(--color-brand-border)',
          }}
        >
          <Trash2
            className="h-5 w-5"
            style={{ color: nearTrash ? '#fff' : 'var(--color-brand-text-muted)' }}
          />
        </motion.div>
      </div>

      {/* Draggable recording chip */}
      <motion.div
        key="recording-chip"
        ref={chipRef}
        initial={{ y: 120, opacity: 0 }}
        animate={{
          y: 0,
          opacity: 1,
          scale: nearTrash ? 0.72 : 1,
          transition: { type: 'spring', stiffness: 380, damping: 30 },
        }}
        exit={{ y: 120, opacity: 0, transition: { duration: 0.18 } }}
        style={{
          x,
          y,
          position: 'fixed',
          bottom: '88px',
          left: 0,
          right: 0,
          marginLeft: 'auto',
          marginRight: 'auto',
          width: 'fit-content',
          zIndex: 61,
          touchAction: 'none',
          userSelect: 'none',
        }}
        drag
        dragMomentum={false}
        onDrag={checkProximity}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-center gap-3 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] shadow-2xl rounded-2xl px-4 py-3">
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

          {/* Stop button */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onStop() }}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-brand-red)]"
            aria-label="Stop recording"
          >
            <div className="w-3 h-3 bg-white rounded-sm" />
          </button>
        </div>
      </motion.div>
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
