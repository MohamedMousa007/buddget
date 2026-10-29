'use client'

import { useEffect, useRef, useCallback, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, type MotionValue } from 'framer-motion'
import { X, RotateCcw, Trash2, MessageCircle, Mic, CheckCircle2 } from 'lucide-react'
import type { VoiceState } from '@/hooks/useVoiceExpense'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { VoiceRecapEditor } from '@/components/voice/VoiceRecapEditor'
import { Button } from '@/components/ui/button'
import type { AIResponse, AIActionItem } from '@/lib/ai/gemini'
import { useDismissable } from '@/hooks/useDismissable'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'

const BARS = 36
const W = BARS * 5
const H = 36

interface Props {
  state: VoiceState
  amplitude: number
  animTime: number
  response: AIResponse | null
  draftActions: AIActionItem[]
  itemErrors: (string | null)[]
  transcript: string | null
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
  onUpdateField: (index: number, key: string, value: unknown) => void
  onRemove: (index: number) => void
  onRedo: () => void
  onClose: () => void
  onOpenChat: () => void
}

export function VoiceRecordOverlay({
  state,
  amplitude,
  animTime,
  response,
  draftActions,
  itemErrors,
  transcript,
  error,
  posX,
  posY,
  nearTrash,
  trashRef,
  onCancel,
  onConfirm,
  onUpdateField,
  onRemove,
  onRedo,
  onClose,
  onOpenChat,
}: Props) {
  const visible = state !== 'idle'
  // Back/Escape cancel the capture rather than navigating away mid-recording.
  useDismissable(visible, onClose)

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
      {(state === 'processing' || state === 'error' || state === 'queued' || state === 'confirming' || state === 'answer' || state === 'clarify') && (
        <motion.div
          key="voice-overlay"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed bottom-18 start-4 end-4 md:mx-auto md:max-w-md z-[60] rounded-2xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] shadow-2xl overflow-hidden"
        >
          {state === 'processing' && <ProcessingPanel onCancel={onCancel} />}
          {state === 'error' && (
            <ErrorPanel error={error} onRedo={onRedo} onClose={onClose} />
          )}
          {state === 'queued' && <QueuedPanel onClose={onClose} />}
          {state === 'confirming' && (
            <VoiceRecapEditor
              compact
              actions={draftActions}
              itemErrors={itemErrors}
              transcript={transcript}
              onUpdateField={onUpdateField}
              onRemove={onRemove}
              onConfirm={onConfirm}
              onRedo={onRedo}
              onCancel={onClose}
            />
          )}
          {state === 'answer' && response && (
            <AnswerPanel message={response.message} onOpenChat={onOpenChat} onRedo={onRedo} onClose={onClose} />
          )}
          {state === 'clarify' && response && (
            <ClarifyPanel message={response.clarificationNeeded || response.message} onAnswer={onRedo} onClose={onClose} />
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
  const v = useT().voice
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
            backgroundColor: nearTrash ? 'var(--color-brand-primary)' : 'var(--color-brand-elevated)',
            borderColor: nearTrash ? 'var(--color-brand-primary)' : 'var(--color-brand-border)',
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
            {/* Buddgy listens while the user talks */}
            <span className="shrink-0 text-[var(--color-brand-text)]">
              <BuddgyIcon mood="listening" size={30} strokeWidth={1.75} filled alive />
            </span>

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
          {nearTrash ? v.releaseToCancel : v.releaseToSave}
        </span>
      </div>
    </>
  )
}

// ── Processing panel ─────────────────────────────────────────────────────────

function ProcessingPanel({ onCancel }: { onCancel: () => void }) {
  const { voice: v, common } = useT()
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[var(--color-brand-text)]"><BuddgyIcon mood="thinking" size={26} strokeWidth={1.75} filled /></span>
        <span className="text-sm text-[var(--color-brand-text-secondary)]">{v.transcribingShort}</span>
      </div>
      <IconButton onClick={onCancel} aria-label={common.cancel}>
        <X className="size-4" />
      </IconButton>
    </div>
  )
}

// ── Queued panel (offline save) ──────────────────────────────────────────────

function QueuedPanel({ onClose }: { onClose: () => void }) {
  const { voice: v, common } = useT()
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-brand-green)]" />
        <p className="text-xs text-[var(--color-brand-text-secondary)] min-w-0">
          {v.offlineBodyShort}
        </p>
      </div>
      <IconButton onClick={onClose} aria-label={common.close}>
        <X className="size-4" />
      </IconButton>
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
  const { voice: v, common } = useT()
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <span className="shrink-0 text-[var(--color-brand-text)]"><BuddgyIcon mood="worried" size={26} strokeWidth={1.75} filled /></span>
      <p className="text-xs text-[var(--color-brand-text-secondary)] min-w-0 truncate flex-1">
        {error ?? v.somethingWrong}
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          onClick={onRedo}
          variant="outline"
          size="xs"
          className="gap-1 rounded-lg bg-[var(--color-brand-elevated)] text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]"
        >
          <RotateCcw className="h-3 w-3" /> {v.tryAgain}
        </Button>
        <IconButton onClick={onClose} aria-label={common.close}>
          <X className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

// ── Answer panel (query) ──────────────────────────────────────────────────────

function AnswerPanel({
  message,
  onOpenChat,
  onRedo,
  onClose,
}: {
  message: string
  onOpenChat: () => void
  onRedo: () => void
  onClose: () => void
}) {
  const { voice: v, common } = useT()
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-[var(--color-brand-text)]"><BuddgyIcon mood="happy" size={26} strokeWidth={1.75} filled /></span>
        <p className="text-sm text-[var(--color-brand-text-primary)] max-h-[34vh] overflow-y-auto">{message}</p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onOpenChat}
          size="sm"
          className="h-8 flex-1 gap-1.5 rounded-xl px-3 text-xs font-semibold"
        >
          <MessageCircle className="h-3.5 w-3.5" /> {v.openInChat}
        </Button>
        <Button
          type="button"
          onClick={onRedo}
          variant="outline"
          size="sm"
          className="h-8 rounded-xl bg-transparent px-3 text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          {v.askAgain}
        </Button>
        <IconButton onClick={onClose} aria-label={common.close}>
          <X className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

// ── Clarify panel ─────────────────────────────────────────────────────────────

function ClarifyPanel({
  message,
  onAnswer,
  onClose,
}: {
  message: string
  onAnswer: () => void
  onClose: () => void
}) {
  const { voice: v, common } = useT()
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-[var(--color-brand-text)]"><BuddgyIcon mood="curious" size={26} strokeWidth={1.75} filled /></span>
        <p className="text-xs text-[var(--color-brand-text-secondary)]">{message || v.detailPrompt}</p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onAnswer}
          size="sm"
          className="h-8 flex-1 gap-1.5 rounded-xl px-3 text-xs font-semibold"
        >
          <Mic className="h-3.5 w-3.5" /> {v.answerByVoice}
        </Button>
        <IconButton onClick={onClose} aria-label={common.close}>
          <X className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}
