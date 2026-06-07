'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { startRecording } from '@/lib/native/voiceRecorder'
import { extractVoiceExpense, type ExtractedExpense } from '@/lib/ai/extractVoiceExpense'

export type VoiceState = 'idle' | 'recording' | 'processing' | 'confirming' | 'error'

interface UseVoiceExpenseResult {
  state: VoiceState
  draft: ExtractedExpense | null
  transcript: string | null
  error: string | null
  /** Normalized amplitude 0–1 updated each animation frame while recording. */
  amplitude: number
  /** Current animation timestamp (ms) — driven by the recording RAF loop. */
  animTime: number
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => Promise<void>
  confirm: () => void
  reset: () => void
}

export function useVoiceExpense(): UseVoiceExpenseResult {
  const recorderRef = useRef<{
    stop(): Promise<{ audio: Blob | null; inlineText: string | null }>
    cancel(): Promise<void>
    getAmplitude(): number
  } | null>(null)
  const rafRef = useRef<number | null>(null)
  // When stop() is called before the recorder is ready (user releases the mic
  // button before startRecording() resolves), this flag causes start() to
  // cancel immediately after initialisation instead of entering recording state.
  const stopPendingRef = useRef(false)

  const [state, setState] = useState<VoiceState>('idle')
  const [draft, setDraft] = useState<ExtractedExpense | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amplitude, setAmplitude] = useState(0)
  const [animTime, setAnimTime] = useState(0)

  const { addExpense, paymentMethods, baseCurrency, language } = useFinanceStore(
    useShallow((s) => ({
      addExpense: s.addExpense,
      paymentMethods: s.paymentMethods,
      baseCurrency: s.settings.baseCurrency,
      language: s.settings.language,
    })),
  )

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setAmplitude(0)
  }, [])

  // Clean up RAF on unmount
  useEffect(() => () => stopRaf(), [stopRaf])

  const reset = useCallback(() => {
    setState('idle')
    setDraft(null)
    setTranscript(null)
    setError(null)
    stopRaf()
  }, [stopRaf])

  const start = useCallback(async () => {
    setError(null)
    setDraft(null)
    setTranscript(null)
    stopPendingRef.current = false
    try {
      const recorder = await startRecording({ language })

      // User released the mic before the recorder was ready — cancel silently.
      if (stopPendingRef.current) {
        stopPendingRef.current = false
        try { await recorder.cancel() } catch { /* noop */ }
        return
      }

      recorderRef.current = recorder
      setState('recording')

      // Amplitude polling loop — native returns 0, simulated as gentle pulse
      const poll = () => {
        if (!recorderRef.current) return
        const now = Date.now()
        const raw = recorderRef.current.getAmplitude()
        setAmplitude(raw > 0.01 ? raw : 0.12 + 0.08 * Math.sin(now / 400))
        setAnimTime(now)
        rafRef.current = requestAnimationFrame(poll)
      }
      rafRef.current = requestAnimationFrame(poll)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not access the microphone'
      setError(msg)
      setState('error')
    }
  }, [language])

  const stop = useCallback(async () => {
    // Null synchronously to block any concurrent cancel() from re-entering
    const recorder = recorderRef.current
    if (!recorder) {
      // Recorder not ready yet — flag start() to cancel after initialisation.
      stopPendingRef.current = true
      return
    }
    recorderRef.current = null
    stopRaf()
    setState('processing')
    try {
      const { audio, inlineText } = await recorder.stop()

      let text = inlineText?.trim() ?? ''

      if (!text && audio) {
        const form = new FormData()
        form.append('audio', audio, `voice-${Date.now()}.webm`)
        form.append('language', language === 'ar' ? 'ar' : 'en')
        const { apiFetchAuth } = await import('@/lib/apiBase')
        const res = await apiFetchAuth('/api/voice/transcribe', {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(err?.error || `Transcription failed (${res.status})`)
        }
        const data = (await res.json()) as { text: string }
        text = data.text?.trim() ?? ''
      }

      if (!text) throw new Error("Couldn't hear that — try again in a quieter spot.")
      setTranscript(text)

      const extracted = await extractVoiceExpense(text, baseCurrency)
      setDraft(extracted)
      setState('confirming')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setState('error')
    }
  }, [baseCurrency, language, stopRaf])

  const cancel = useCallback(async () => {
    // Null synchronously so stop() returns early if called concurrently
    stopPendingRef.current = false
    const recorder = recorderRef.current
    recorderRef.current = null
    stopRaf()
    try { await recorder?.cancel() } catch { /* noop */ }
    reset()
  }, [reset, stopRaf])

  const confirm = useCallback(() => {
    if (!draft) return
    const defaultPm = paymentMethods.find((pm) => pm.isDefault) ?? paymentMethods[0]
    const today = new Date().toISOString().slice(0, 10)
    addExpense({
      date: today,
      description: draft.description,
      category: draft.category,
      amount: draft.amount,
      currency: draft.currency,
      paymentMethodId: defaultPm?.id ?? '',
      isRecurring: false,
      notes: transcript ? `voice: ${transcript}` : undefined,
    })
    reset()
  }, [addExpense, draft, paymentMethods, reset, transcript])

  return { state, draft, transcript, error, amplitude, animTime, start, stop, cancel, confirm, reset }
}
