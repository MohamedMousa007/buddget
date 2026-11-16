'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { withNativeFlow } from '@/lib/native/appLockPolicy'
import { getMicPermissionStatus, requestMicPermission, startRecording, type VoiceRecording } from '@/lib/native/voiceRecorder'
import { logVoiceStage } from '@/lib/voice/voiceStages'
import { useBuddgyMoodWhile } from '@/lib/ai/useBuddgyMood'

export type RecorderState = 'idle' | 'permission' | 'recording'
export type StartResult = { kind: 'recording' } | { kind: 'permission' } | { kind: 'error'; message: string }

interface Handle {
  stop(): Promise<VoiceRecording>
  cancel(): Promise<void>
  getAmplitude(): number
}

/**
 * The microphone half of voice: permission, recording and the live amplitude. Shared by the voice sheet (`useVoiceExpense`)
 * and the chat mic, so both record the same way. It records and hands back the audio; what happens next is the caller's.
 */
export function useVoiceRecorder() {
  const vt = useT().voice
  const handleRef = useRef<Handle | null>(null)
  const rafRef = useRef<number | null>(null)
  const stopPendingRef = useRef(false)
  const [state, setState] = useState<RecorderState>('idle')
  const [amplitude, setAmplitude] = useState(0)
  const [animTime, setAnimTime] = useState(0)

  // Buddgy's face mirrors the mic; bound declaratively so an unmount mid-recording releases it.
  useBuddgyMoodWhile('listening', state === 'recording')

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setAmplitude(0)
  }, [])
  useEffect(() => () => stopRaf(), [stopRaf])

  /** Asks for the microphone once. Resolves to an error message when it is denied, else null. */
  const requestPermission = useCallback(async (): Promise<string | null> => {
    if (getMicPermissionStatus() === 'granted') return null
    setState('permission')
    try {
      const status = await withNativeFlow(() => requestMicPermission())
      setState('idle')
      return status === 'granted' ? null : vt.errors.micDenied
    } catch {
      setState('idle')
      return null
    }
  }, [vt])

  const start = useCallback(async (): Promise<StartResult> => {
    stopPendingRef.current = false
    if (getMicPermissionStatus() !== 'granted') {
      const denied = await requestPermission()
      return denied ? { kind: 'error', message: denied } : { kind: 'permission' }
    }
    try {
      const recorder = await startRecording({})
      if (stopPendingRef.current) {
        stopPendingRef.current = false
        try { await recorder.cancel() } catch { /* noop */ }
        return { kind: 'permission' }
      }
      handleRef.current = recorder
      setState('recording')
      logVoiceStage('record', 'start')
      const poll = () => {
        if (!handleRef.current) return
        const now = Date.now()
        const raw = handleRef.current.getAmplitude()
        setAmplitude(raw > 0.01 ? raw : 0.12 + 0.08 * Math.sin(now / 400))
        setAnimTime(now)
        rafRef.current = requestAnimationFrame(poll)
      }
      rafRef.current = requestAnimationFrame(poll)
      return { kind: 'recording' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : vt.errors.micFallback
      return { kind: 'error', message: vt.errors.stepFormat(vt.stages.record, msg) }
    }
  }, [requestPermission, vt])

  /** Ends the recording and returns the audio; null when nothing was recording (a stop that came before the start finished is remembered). */
  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    const recorder = handleRef.current
    if (!recorder) {
      stopPendingRef.current = true
      return null
    }
    handleRef.current = null
    stopRaf()
    setState('idle')
    logVoiceStage('record', 'ok')
    return recorder.stop()
  }, [stopRaf])

  const cancel = useCallback(async () => {
    stopPendingRef.current = false
    const recorder = handleRef.current
    handleRef.current = null
    stopRaf()
    setState('idle')
    try { await recorder?.cancel() } catch { /* noop */ }
  }, [stopRaf])

  return { state, amplitude, animTime, start, stop, cancel, requestPermission }
}
