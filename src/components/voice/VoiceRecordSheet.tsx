'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, X, Loader2, AlertTriangle, Trash2, MessageCircle, Volume2, VolumeX, CheckCircle2 } from 'lucide-react'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { ModalShell } from '@/components/modals/ModalShell'
import { useVoiceExpense } from '@/hooks/useVoiceExpense'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { VoiceRecapEditor } from '@/components/voice/VoiceRecapEditor'
import { speak, stopSpeaking } from '@/lib/voice/speak'
import { isNative } from '@/lib/native/isNative'

interface VoiceRecordSheetProps {
  open: boolean
  onClose: () => void
}

export function VoiceRecordSheet({ open, onClose }: VoiceRecordSheetProps) {
  const {
    state, response, draftActions, itemErrors, transcript, error, amplitude, animTime,
    start, stop, cancel, updateDraftField, removeDraftAction, confirm, reset, requestPermission, openInChat,
  } = useVoiceExpense()

  // Pre-flight mic permission when the sheet opens so the OS dialog never races
  // with the hold gesture. If already granted, requestPermission() is a no-op.
  useEffect(() => {
    if (open) {
      void requestPermission()
    } else {
      reset()
    }
  }, [open, requestPermission, reset])

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
        {state === 'permission' ? (
          <PermissionView onRequest={() => void requestPermission()} />
        ) : null}

        {state === 'error' ? (
          <ErrorView error={error} onRetry={reset} onClose={() => void handleCancel()} />
        ) : null}

        {state === 'queued' ? <QueuedView onClose={onClose} /> : null}

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

        {state === 'processing' ? <ProcessingView onCancel={() => void handleCancel()} /> : null}

        {state === 'confirming' ? (
          <VoiceRecapEditor
            actions={draftActions}
            itemErrors={itemErrors}
            transcript={transcript}
            onUpdateField={updateDraftField}
            onRemove={removeDraftAction}
            onConfirm={() => { if (confirm()) onClose() }}
            onRedo={() => { reset(); void start() }}
            onCancel={() => void handleCancel()}
          />
        ) : null}

        {state === 'answer' && response ? (
          <AnswerView
            message={response.message}
            transcript={transcript}
            onAskAgain={() => { reset(); void start() }}
            onOpenChat={() => { openInChat(); onClose() }}
            onClose={() => void handleCancel()}
          />
        ) : null}

        {state === 'clarify' && response ? (
          <ClarifyView
            message={response.clarificationNeeded || response.message}
            onAnswer={() => { reset(); void start() }}
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

// ── Recording view — hold-to-record + trash-can cancel ───────────────────────

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
  const y = useMotionValue(0)

  // Distance from origin — drives trash icon scale and color intensity
  const distance = useMotionValue(0)
  const trashScale = useTransform(distance, [0, 70], [1, 1.35])
  const trashOpacity = useTransform(distance, [0, 30], [0.5, 1])
  const trashBg = useTransform(distance, [30, 70], ['rgba(255,255,255,0.08)', 'rgba(225,36,36,0.25)'])

  const cancelledRef = useRef(false)
  const touchActiveRef = useRef(false)

  const triggerCancel = () => {
    cancelledRef.current = true
    touchActiveRef.current = false
    x.set(0)
    y.set(0)
    distance.set(0)
    onCancel()
  }

  return (
    <>
      <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
        {isRecording ? 'Listening… speak your expense.' : 'Hold mic to record'}
      </p>

      {isRecording ? <Visualizer amplitude={amplitude} animTime={animTime} /> : null}

      {/* Trash can — appears above the mic when recording */}
      <div className="relative flex flex-col items-center justify-center gap-3 my-2">
        <AnimatePresence>
          {isRecording ? (
            <motion.div
              key="trash"
              initial={{ opacity: 0, scale: 0.6, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              style={{ opacity: trashOpacity, scale: trashScale, background: trashBg }}
              className="flex items-center justify-center w-12 h-12 rounded-full border border-[var(--color-brand-border)] pointer-events-none"
              aria-hidden
            >
              <Trash2 className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Draggable mic button */}
        <motion.div
          drag={isRecording ? true : false}
          dragConstraints={{ left: -90, right: 0, top: -80, bottom: 0 }}
          dragElastic={0.12}
          style={{ x, y, touchAction: 'none' }}
          className="relative flex items-center justify-center"
          onDrag={(_, info) => {
            const d = Math.sqrt(info.offset.x ** 2 + info.offset.y ** 2)
            distance.set(d)
          }}
          onTouchStart={(e) => {
            e.preventDefault()
            if (state !== 'idle' || touchActiveRef.current) return
            cancelledRef.current = false
            touchActiveRef.current = true
            void onStart()
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            if (!touchActiveRef.current || cancelledRef.current) return
            touchActiveRef.current = false
            onStop()
          }}
          onPointerDown={(e) => {
            if (e.pointerType === 'touch') return
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
            distance.set(0)
            // Cancel if dragged left far enough OR up toward the trash
            if (info.offset.x < -65 || info.offset.y < -55) {
              triggerCancel()
            } else {
              x.set(0)
              y.set(0)
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
          ? 'Release to transcribe · Drag to trash to cancel'
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

// ── Permission ───────────────────────────────────────────────────────────────

function PermissionView({ onRequest }: { onRequest: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)]">
        <MicOff className="h-7 w-7 text-[var(--color-brand-text-muted)]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">Microphone access needed</p>
        <p className="mt-1 text-xs text-[var(--color-brand-text-muted)] max-w-[260px]">
          Allow microphone access so Buddget can hear your expense.
        </p>
      </div>
      <button
        type="button"
        onClick={onRequest}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
      >
        <Mic className="h-4 w-4" /> Allow Microphone
      </button>
    </div>
  )
}

// ── Processing ──────────────────────────────────────────────────────────────

function ProcessingView({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 w-full">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-red)]" />
      <p className="text-sm text-[var(--color-brand-text-secondary)]">Transcribing your voice…</p>
      <button
        type="button"
        onClick={onCancel}
        className="mt-1 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        aria-label="Cancel transcription"
      >
        <X className="h-4 w-4" /> Cancel
      </button>
    </div>
  )
}

// ── Answer (query, read-only) ─────────────────────────────────────────────────

function AnswerView({
  message,
  transcript,
  onAskAgain,
  onOpenChat,
  onClose,
}: {
  message: string
  transcript: string | null
  onAskAgain: () => void
  onOpenChat: () => void
  onClose: () => void
}) {
  const muted = useSettingsStore((s) => s.voiceSpeakMuted)
  const setMuted = useSettingsStore((s) => s.setVoiceSpeakMuted)

  return (
    <div className="w-full">
      {transcript ? (
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          You asked: <span className="italic">&ldquo;{transcript}&rdquo;</span>
        </p>
      ) : null}

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4">
        <p className="flex-1 text-sm text-[var(--color-brand-text-primary)]">{message}</p>
        <button
          type="button"
          onClick={() => {
            const next = !muted
            setMuted(next)
            if (next) stopSpeaking()
            else speak(message)
          }}
          className="shrink-0 rounded-lg p-1.5 text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          aria-label={muted ? 'Unmute answer' : 'Mute answer'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onOpenChat}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <MessageCircle className="h-4 w-4" />
          Open in chat
        </button>
        <button
          type="button"
          onClick={onAskAgain}
          className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          Ask again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-2.5 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ── Clarify (needs more info) ─────────────────────────────────────────────────

function ClarifyView({
  message,
  onAnswer,
  onCancel,
}: {
  message: string
  onAnswer: () => void
  onCancel: () => void
}) {
  return (
    <div className="w-full text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)]">
        <Mic className="h-6 w-6 text-[var(--color-brand-text-muted)]" />
      </div>
      <p className="mt-3 text-sm text-[var(--color-brand-text-primary)] max-w-[300px] mx-auto">
        {message || 'Could you add a bit more detail?'}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={onAnswer}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <Mic className="h-4 w-4" />
          Answer by voice
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-2.5 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Error ────────────────────────────────────────────────────────────────────

function QueuedView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <CheckCircle2 className="h-8 w-8 text-[var(--color-brand-green)]" />
      <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">
        Recording saved
      </p>
      <p className="text-xs text-[var(--color-brand-text-muted)] max-w-[280px]">
        You&apos;re offline right now, so we kept it on your device. When you&apos;re back
        online, a chip will appear at the top of the app — tap it to finish adding
        this expense.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 rounded-xl bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
      >
        Done
      </button>
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
