'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { useT } from '@/lib/i18n'
import { transcribeAudio } from '@/lib/voice/transcribeAudio'
import { VoiceStageError } from '@/lib/voice/voiceStages'

const TRANSCRIBE_TIMEOUT_MS = 20_000

export type ChatVoiceState = 'idle' | 'recording' | 'transcribing'

/**
 * A voice message in Buddgy chat: tap the mic to record, tap again and the audio is transcribed and sent as a normal message
 * (its words show in the bubble, so a mistake is visible and fixed by saying it again). Recording is the voice sheet's recorder.
 */
export function useChatVoice(onText: (text: string) => void) {
  const { session } = useAuth()
  const vt = useT().voice
  const recorder = useVoiceRecorder()
  const { start: recStart, stop: recStop, cancel: recCancel } = recorder
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Closing the chat mid-recording releases the microphone and drops the request.
  useEffect(() => () => { abortRef.current?.abort(); void recCancel() }, [recCancel])

  const state: ChatVoiceState = recorder.state === 'recording' ? 'recording' : busy ? 'transcribing' : 'idle'

  const start = useCallback(async () => {
    setError(null)
    const out = await recStart()
    if (out.kind === 'error') setError(out.message)
  }, [recStart])

  const stop = useCallback(async () => {
    const recording = await recStop()
    if (!recording?.audio) return
    const abort = new AbortController()
    abortRef.current = abort
    const timer = setTimeout(() => abort.abort(), TRANSCRIBE_TIMEOUT_MS)
    setBusy(true)
    try {
      const text = await transcribeAudio({
        audio: recording.audio,
        mimeType: recording.mimeType,
        signal: abort.signal,
        accessToken: session?.access_token,
        errors: { tooLarge: vt.errors.tooLarge, transcriptionFailed: vt.errors.transcriptionFailed },
      })
      if (text) onText(text)
      else setError(vt.errors.noCatch)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') setError(vt.errors.transcribeSlow)
      else setError(e instanceof VoiceStageError ? e.userMessage : vt.errors.serverUnreachable)
    } finally {
      clearTimeout(timer)
      abortRef.current = null
      setBusy(false)
    }
  }, [recStop, session, vt, onText])

  const cancel = useCallback(async () => {
    abortRef.current?.abort()
    await recCancel()
  }, [recCancel])

  return { state, error, amplitude: recorder.amplitude, start, stop, cancel, clearError: () => setError(null) }
}
