'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { startRecording, requestMicPermission, getMicPermissionStatus } from '@/lib/native/voiceRecorder'
import { runAiCommand, type AiCommandStats } from '@/lib/ai/runAiCommand'
import { classifyVoiceIntent } from '@/lib/voice/classifyVoiceIntent'
import { needsEscalation } from '@/lib/voice/escalation'
import {
  buildAIActionHandlerContext,
  executeActionItem,
  validateActionItem,
} from '@/lib/ai/aiActionHandlers'
import type { AIResponse, AIActionItem } from '@/lib/ai/gemini'
import {
  logVoiceStage,
  runStage,
  voiceStageLabel,
  VoiceStageError,
  type VoiceStage,
} from '@/lib/voice/voiceStages'
import { speak, stopSpeaking } from '@/lib/voice/speak'
import { isOnline } from '@/hooks/useNetworkStatus'
import { isNative } from '@/lib/native/isNative'
import { usePendingAiJobs, savePendingMedia, deletePendingMedia } from '@/lib/store/usePendingAiJobs'

export type VoiceState =
  | 'idle'
  | 'permission'
  | 'recording'
  | 'processing'
  | 'confirming'
  | 'answer'
  | 'clarify'
  | 'error'
  /** Offline: recording saved on-device, queued for the pending-captures chip. */
  | 'queued'

const TRANSCRIBE_TIMEOUT_MS = 20_000
// Extract may run two sequential model calls (tier-1 → escalate to tier-2), so it
// gets a wider budget than a single stage.
const EXTRACT_TIMEOUT_MS = 30_000

/**
 * Temporary on-device diagnostic for auth rejections. Decodes the current Supabase
 * access token client-side and reports exactly why a 401/403 happened (missing /
 * expired / wrong issuer), so the failure is actionable from the device.
 */
async function diagnoseAuth(status: number): Promise<{ message: string; hasToken: boolean }> {
  let message: string
  let hasToken = false
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const { data: { session }, error } = await createClient().auth.getSession()
    const tok = session?.access_token
    if (!tok) {
      message = `no session token on device — sign in again. (getSession err=${error?.message ?? 'none'})`
    } else {
      hasToken = true
      let b64 = tok.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/') ?? ''
      b64 += '='.repeat((4 - (b64.length % 4)) % 4)
      const p = JSON.parse(atob(b64)) as { exp?: number }
      const expMs = (p.exp ?? 0) * 1000
      message = expMs < Date.now() ? 'your session expired — sign in again.' : 'token looks valid; please retry.'
    }
  } catch {
    message = 'could not verify your session — sign in again.'
  }
  logVoiceStage('transcribe', 'fail', `auth=${status} ${message}`)
  return { message, hasToken }
}

/**
 * Turn a transcript into an AIResponse via the two-tier router:
 * heuristic pre-route → lean tier-1 extractor → escalate to the full brain only
 * when needed. The tier taken is logged on the `extract` breadcrumb.
 */
async function extractCommand(
  store: ReturnType<typeof useFinanceStore.getState>,
  stats: AiCommandStats,
  monthFilter: string,
  text: string,
  signal: AbortSignal,
): Promise<AIResponse> {
  if (classifyVoiceIntent(text) === 'complex') {
    const r = await runAiCommand({ store, stats, monthFilter, text, mode: 'voice', signal })
    logVoiceStage('extract', 'ok', 'tier=2')
    return r
  }
  const tier1 = await runAiCommand({ store, stats, monthFilter, text, mode: 'voiceExtract', signal })
  if (needsEscalation(tier1)) {
    const r = await runAiCommand({ store, stats, monthFilter, text, mode: 'voice', signal })
    logVoiceStage('extract', 'ok', 'tier=1→2')
    return r
  }
  logVoiceStage('extract', 'ok', 'tier=1')
  return tier1
}

export interface UseVoiceCommandResult {
  state: VoiceState
  /** Parsed AI command — confirmation list, query answer, or clarification. */
  response: AIResponse | null
  /** Editable add-actions shown in the recap (mutated via updateDraftField/removeDraftAction). */
  draftActions: AIActionItem[]
  /** Per-item validation error, aligned by index with draftActions. */
  itemErrors: (string | null)[]
  transcript: string | null
  error: string | null
  amplitude: number
  animTime: number
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => Promise<void>
  /** Edit one field of a recap item before saving. */
  updateDraftField: (index: number, key: string, value: unknown) => void
  /** Drop one item from the recap. */
  removeDraftAction: (index: number) => void
  /** Apply all recap items. Returns true when everything was saved. */
  confirm: () => boolean
  reset: () => void
  requestPermission: () => Promise<void>
  /** Hand the transcript off to the full AI chat to continue the conversation. */
  openInChat: () => void
}

/** Stores the audio on-device and enqueues a pending voice job. */
async function queueVoiceCapture(audio: Blob, mimeType: string | null): Promise<boolean> {
  try {
    const arrayBuffer = await audio.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)))
    }
    const { newClientId } = await import('@/lib/store/useFinanceStore')
    const id = newClientId()
    if (!(await savePendingMedia(id, btoa(binary)))) return false
    const added = usePendingAiJobs.getState().addJob({
      id,
      kind: 'voice',
      mimeType: audio.type || mimeType || 'audio/mp4',
      createdAt: new Date().toISOString(),
    })
    if (!added) void deletePendingMedia(id)
    return added
  } catch {
    return false
  }
}

export function useVoiceExpense(): UseVoiceCommandResult {
  const { session } = useAuth()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const stats = useMonthlyStats()
  const statsRef = useRef<AiCommandStats>(stats)
  statsRef.current = stats

  const recorderRef = useRef<{
    stop(): Promise<{ audio: Blob | null; inlineText: string | null; mimeType: string | null }>
    cancel(): Promise<void>
    getAmplitude(): number
  } | null>(null)
  const rafRef = useRef<number | null>(null)
  const stopPendingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const [state, setState] = useState<VoiceState>('idle')
  const [response, setResponse] = useState<AIResponse | null>(null)
  /** Editable copy of the extracted add-actions shown in the recap. */
  const [draftActions, setDraftActions] = useState<AIActionItem[]>([])
  /** Per-item validation error, aligned by index with draftActions. */
  const [itemErrors, setItemErrors] = useState<(string | null)[]>([])
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amplitude, setAmplitude] = useState(0)
  const [animTime, setAnimTime] = useState(0)

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setAmplitude(0)
  }, [])

  useEffect(() => () => stopRaf(), [stopRaf])

  const reset = useCallback(() => {
    stopSpeaking()
    setState('idle')
    setResponse(null)
    setDraftActions([])
    setItemErrors([])
    setTranscript(null)
    setError(null)
    stopRaf()
  }, [stopRaf])

  const requestPermission = useCallback(async () => {
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
      setState('idle')
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setResponse(null)
    setTranscript(null)
    stopPendingRef.current = false

    if (getMicPermissionStatus() !== 'granted') {
      await requestPermission()
      return
    }

    try {
      const recorder = await startRecording({})
      if (stopPendingRef.current) {
        stopPendingRef.current = false
        try { await recorder.cancel() } catch { /* noop */ }
        return
      }
      recorderRef.current = recorder
      setState('recording')
      logVoiceStage('record', 'start')

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
      setError(`${voiceStageLabel('record')} step — ${msg}`)
      setState('error')
    }
  }, [requestPermission])

  /** POST the audio to the transcribe route (base64 JSON bypasses CapacitorHttp
   *  header stripping) and return the text. Handles the 401 self-heal. */
  const transcribeAudio = useCallback(
    async (audio: Blob, mimeType: string | null, signal: AbortSignal): Promise<string> => {
      const mime = audio.type || mimeType || 'audio/mp4'
      const arrayBuffer = await audio.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)))
      }
      const base64Audio = btoa(binary)
      const language = useFinanceStore.getState().settings.language === 'ar' ? 'ar' : 'en'
      const body = JSON.stringify({ audio: base64Audio, mimeType: mime, language })

      const { apiFetchAuth } = await import('@/lib/apiBase')
      const headers: HeadersInit = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' }
      const res = await apiFetchAuth('/api/voice/transcribe', { method: 'POST', body, signal, headers })

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        if (res.status === 401 || res.status === 403) {
          const diag = await diagnoseAuth(res.status)
          if (!diag.hasToken) {
            try {
              const { createClient } = await import('@/lib/supabase/client')
              await createClient().auth.signOut()
            } catch { /* noop */ }
          }
          throw new VoiceStageError('transcribe', diag.message)
        }
        throw new VoiceStageError('transcribe', err?.error || `transcription failed (${res.status})`)
      }
      const data = (await res.json()) as { text?: string }
      return data.text?.trim() ?? ''
    },
    [session],
  )

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder) {
      stopPendingRef.current = true
      return
    }
    recorderRef.current = null
    stopRaf()
    logVoiceStage('record', 'ok')
    setState('processing')

    const abort = new AbortController()
    abortRef.current = abort

    // Each stage owns and clears its own timer, so a resolved stage's timeout can
    // never fire mid-next-stage and abort it (which would strand the UI).
    const withTimeout = <T,>(p: Promise<T>, ms: number, stage: VoiceStage, msg: string): Promise<T> => {
      let handle: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<T>((_, reject) => {
        handle = setTimeout(() => {
          abort.abort()
          reject(new VoiceStageError(stage, msg))
        }, ms)
      })
      return Promise.race([p, timeout]).finally(() => clearTimeout(handle))
    }

    try {
      const { audio, inlineText, mimeType } = await recorder.stop()
      let text = inlineText?.trim() ?? ''

      // Offline capture-now-process-later (native): keep the recording on
      // device and queue it — the PendingCapturesChip replays it through
      // transcription once the network returns. Web offline falls through to
      // the normal transcribe error (no queue).
      if (!text && audio && isNative() && !isOnline()) {
        const saved = await queueVoiceCapture(audio, mimeType)
        if (saved) {
          logVoiceStage('transcribe', 'ok', 'queued_offline')
          setState('queued')
          return
        }
      }

      // Web offline (no capture queue): fail fast with an honest message
      // instead of a 20s timeout ending in "couldn't reach the server".
      if (!text && audio && !isNative() && !isOnline()) {
        throw new VoiceStageError(
          'transcribe',
          "You're offline. Voice needs an internet connection — please try again once you're back online.",
        )
      }

      if (!text && audio) {
        text = await runStage('transcribe', "couldn't reach the server", () =>
          withTimeout(
            transcribeAudio(audio, mimeType, abort.signal),
            TRANSCRIBE_TIMEOUT_MS,
            'transcribe',
            'Transcription took too long. Please try again.',
          ),
        )
      }

      if (!text) throw new VoiceStageError('transcribe', "Didn't catch that — try again in a quieter spot.")
      setTranscript(text)

      const store = useFinanceStore.getState()
      const aiResponse = await runStage('extract', "the assistant didn't respond", () =>
        withTimeout(
          extractCommand(store, statsRef.current, monthFilter, text, abort.signal),
          EXTRACT_TIMEOUT_MS,
          'extract',
          'The assistant took too long. Please try again.',
        ),
      )

      setResponse(aiResponse)
      const writeActions = aiResponse.actions.filter(
        (a) => a.action !== 'query' && a.action !== 'unclear' && a.action !== 'escalate',
      )
      const needsClarify =
        !!aiResponse.clarificationNeeded || aiResponse.actions.some((a) => a.action === 'unclear')

      if (writeActions.length > 0) {
        // Seed an editable, deep-cloned draft the recap can mutate per item.
        setDraftActions(writeActions.map((a) => ({ action: a.action, data: { ...a.data } })))
        setItemErrors([])
        setState('confirming')
      } else if (needsClarify) {
        setState('clarify')
      } else {
        setState('answer')
        if (!useSettingsStore.getState().voiceSpeakMuted) {
          speak(aiResponse.message, useFinanceStore.getState().settings.language)
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      const msg = e instanceof VoiceStageError ? e.userMessage : e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setState('error')
    } finally {
      abortRef.current = null
    }
  }, [monthFilter, stopRaf, transcribeAudio])

  const cancel = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = null
    stopPendingRef.current = false
    const recorder = recorderRef.current
    recorderRef.current = null
    stopRaf()
    try { await recorder?.cancel() } catch { /* noop */ }
    reset()
  }, [reset, stopRaf])

  const updateDraftField = useCallback((index: number, key: string, value: unknown) => {
    setDraftActions((prev) =>
      prev.map((a, i) => (i === index ? { action: a.action, data: { ...a.data, [key]: value } } : a)),
    )
    // Clear this row's error as the user edits it.
    setItemErrors((prev) => (prev.length ? prev.map((e, i) => (i === index ? null : e)) : prev))
  }, [])

  const removeDraftAction = useCallback((index: number) => {
    setDraftActions((prev) => prev.filter((_, i) => i !== index))
    setItemErrors((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const confirm = useCallback((): boolean => {
    if (draftActions.length === 0) return false
    const store = useFinanceStore.getState()
    const ctx = buildAIActionHandlerContext(store)

    // Validate every item; on any failure stay in the recap with per-item errors
    // so the user can fix or remove just the offending row (no full-recap wipe).
    const errs = draftActions.map(({ action, data }) =>
      validateActionItem(ctx, action, data as Record<string, unknown>),
    )
    if (errs.some(Boolean)) {
      logVoiceStage('validate', 'fail', errs.filter(Boolean).join(' | '))
      setItemErrors(errs)
      return false
    }
    logVoiceStage('validate', 'ok', `items=${draftActions.length}`)

    try {
      for (const { action, data } of draftActions) {
        executeActionItem(ctx, action, data as Record<string, unknown>)
      }
      logVoiceStage('apply', 'ok', `items=${draftActions.length}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save'
      logVoiceStage('apply', 'fail', msg)
      setError(`${voiceStageLabel('apply')} step — ${msg}`)
      setState('error')
      return false
    }
    reset()
    return true
  }, [draftActions, reset])

  const openInChat = useCallback(() => {
    const text = transcript
    reset()
    if (text) useSettingsStore.getState().openAiChatWithSeed(text)
  }, [transcript, reset])

  return {
    state,
    response,
    draftActions,
    itemErrors,
    transcript,
    error,
    amplitude,
    animTime,
    start,
    stop,
    cancel,
    updateDraftField,
    removeDraftAction,
    confirm,
    reset,
    requestPermission,
    openInChat,
  }
}
