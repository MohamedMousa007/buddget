'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { startRecording, requestMicPermission, getMicPermissionStatus } from '@/lib/native/voiceRecorder'
import { extractVoiceExpense, type ExtractedExpense } from '@/lib/ai/extractVoiceExpense'

export type VoiceState = 'idle' | 'permission' | 'recording' | 'processing' | 'confirming' | 'error'

/**
 * Temporary on-device diagnostic for the persistent voice 401/403. Decodes the
 * current Supabase access token client-side and reports exactly why the server
 * rejected it (missing / expired / wrong issuer), so the failure is actionable
 * from the device instead of guessing from server logs.
 */
async function diagnoseAuth(status: number): Promise<string> {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const { data: { session } } = await createClient().auth.getSession()
    const tok = session?.access_token
    if (!tok) return `Auth ${status}: no session token on device — sign out and sign in again.`
    let b64 = tok.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/') ?? ''
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const p = JSON.parse(atob(b64)) as { exp?: number; iss?: string }
    const expMs = (p.exp ?? 0) * 1000
    const expd = expMs < Date.now()
    const iss = (p.iss ?? '?').replace('https://', '').split('.')[0]
    return `Auth ${status}: token ${expd ? 'EXPIRED' : 'valid'} (exp ${new Date(expMs).toISOString().slice(11, 19)}, now ${new Date().toISOString().slice(11, 19)}), iss=${iss}, len=${tok.length}.`
  } catch (e) {
    return `Auth ${status}: token decode failed (${e instanceof Error ? e.message : 'err'}).`
  }
}

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
  /** Pre-flight mic permission request. Call this before the user holds the mic
   *  button so the OS dialog doesn't race with the hold gesture. */
  requestPermission: () => Promise<void>
}

export function useVoiceExpense(): UseVoiceExpenseResult {
  const recorderRef = useRef<{
    stop(): Promise<{ audio: Blob | null; inlineText: string | null; mimeType: string | null }>
    cancel(): Promise<void>
    getAmplitude(): number
  } | null>(null)
  const rafRef = useRef<number | null>(null)
  // When stop() is called before the recorder is ready (user releases the mic
  // button before startRecording() resolves), this flag causes start() to
  // cancel immediately after initialisation instead of entering recording state.
  const stopPendingRef = useRef(false)
  // AbortController for the in-flight transcribe fetch — aborted by cancel().
  const abortRef = useRef<AbortController | null>(null)

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

  const requestPermission = useCallback(async () => {
    // Already granted — no-op (avoids a visible state flicker on re-opens)
    if (getMicPermissionStatus() === 'granted') return
    setState('permission')
    try {
      const status = await requestMicPermission()
      if (status === 'granted') {
        setState('idle')
      } else {
        setError('Microphone access denied. Please enable it in your device Settings.')
        setState('error')
      }
    } catch {
      setState('idle') // permission check failed unexpectedly — let start() handle it
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setDraft(null)
    setTranscript(null)
    stopPendingRef.current = false

    // If permission is not yet confirmed, request it now and bail. The OS dialog
    // will appear; on the next hold gesture recording starts normally.
    if (getMicPermissionStatus() !== 'granted') {
      await requestPermission()
      return
    }

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

      // Amplitude polling loop
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
  }, [language, requestPermission])

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

    // AbortController lets cancel() abort the in-flight fetch instantly.
    const abort = new AbortController()
    abortRef.current = abort

    // 25-second wall-clock guard — Groq Whisper + Gemini can take 10-15 s on slow networks.
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null
    const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error('Transcription took longer than expected. Please try again.')),
            25_000,
          )
        }),
      ])

    try {
      const { audio, inlineText, mimeType } = await withTimeout(recorder.stop())

      let text = inlineText?.trim() ?? ''

      if (!text && audio) {
        const { audioMimeToExt } = await import('@/lib/voice/audioMime')
        const ext = audioMimeToExt(audio.type || mimeType)
        const form = new FormData()
        form.append('audio', audio, `voice-${Date.now()}.${ext}`)
        form.append('language', language === 'ar' ? 'ar' : 'en')
        const { apiFetchAuth } = await import('@/lib/apiBase')
        const res = await withTimeout(
          apiFetchAuth('/api/voice/transcribe', { method: 'POST', body: form, signal: abort.signal }),
        )
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null
          if (res.status === 401 || res.status === 403) {
            throw new Error(await diagnoseAuth(res.status))
          }
          throw new Error(err?.error || `Transcription failed (${res.status})`)
        }
        const data = (await res.json()) as { text: string }
        text = data.text?.trim() ?? ''
      }

      if (!text) throw new Error("Couldn't hear that — try again in a quieter spot.")
      setTranscript(text)

      const extracted = await withTimeout(extractVoiceExpense(text, baseCurrency))
      setDraft(extracted)
      setState('confirming')
    } catch (e) {
      // AbortError fires when cancel() is called mid-fetch — go silent back to idle.
      if (e instanceof Error && e.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setState('error')
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle)
      abortRef.current = null
    }
  }, [baseCurrency, language, stopRaf])

  const cancel = useCallback(async () => {
    // Abort any in-flight transcribe fetch immediately.
    abortRef.current?.abort()
    abortRef.current = null
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

  return { state, draft, transcript, error, amplitude, animTime, start, stop, cancel, confirm, reset, requestPermission }
}
