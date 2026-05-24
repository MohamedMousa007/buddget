'use client'

import { isNative } from '@/lib/native/isNative'

export interface VoiceRecording {
  /** Audio Blob (web fallback) — `null` when native SpeechRecognition produced text directly. */
  audio: Blob | null
  /** Optional inline transcript from the OS speech engine (Capacitor SR). */
  inlineText: string | null
  /** ISO ms duration of the captured clip. */
  durationMs: number
  /** Mime type of the captured audio (web fallback). */
  mimeType: string | null
}

interface RecorderHandle {
  stop(): Promise<VoiceRecording>
  cancel(): Promise<void>
}

/**
 * Starts a voice recording. Prefers the Capacitor Speech Recognition plugin on
 * native (faster + no audio upload). Falls back to MediaRecorder on web.
 *
 * Always wrap calls in try/catch — the underlying APIs throw when permission
 * is denied.
 */
export async function startRecording(): Promise<RecorderHandle> {
  if (isNative()) {
    try {
      return await startNativeRecording()
    } catch (e) {
      console.warn('[voice] native recorder failed, falling back to web', e)
    }
  }
  return startWebRecording()
}

async function startNativeRecording(): Promise<RecorderHandle> {
  const mod = await import('@capacitor-community/speech-recognition')
  const SR = mod.SpeechRecognition
  const start = Date.now()

  const perm = await SR.checkPermissions()
  if (perm.speechRecognition !== 'granted') {
    const r = await SR.requestPermissions()
    if (r.speechRecognition !== 'granted') {
      throw new Error('Microphone permission denied')
    }
  }

  const transcript: string[] = []
  const listener = await SR.addListener('partialResults', (data: { matches?: string[] }) => {
    const text = data.matches?.[0]
    if (text) transcript[0] = text
  })

  await SR.start({
    language: 'en-US',
    maxResults: 1,
    prompt: 'Speak your expense',
    partialResults: true,
    popup: false,
  })

  let stopped = false

  return {
    async stop() {
      if (stopped) return { audio: null, inlineText: transcript[0] ?? null, durationMs: 0, mimeType: null }
      stopped = true
      try {
        await SR.stop()
      } catch {
        /* noop */
      }
      try {
        await listener.remove()
      } catch {
        /* noop */
      }
      return {
        audio: null,
        inlineText: transcript[0] ?? null,
        durationMs: Date.now() - start,
        mimeType: null,
      }
    },
    async cancel() {
      stopped = true
      try {
        await SR.stop()
      } catch {
        /* noop */
      }
      try {
        await listener.remove()
      } catch {
        /* noop */
      }
    },
  }
}

async function startWebRecording(): Promise<RecorderHandle> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available on this device')
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Recording is not supported in this browser')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mime = pickPreferredMime()
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  const start = Date.now()

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  let stopped = false
  recorder.start(250)

  const stopAndCollect = (): Promise<Blob> =>
    new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        resolve(blob)
      }
      if (recorder.state !== 'inactive') recorder.stop()
      else resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
    })

  return {
    async stop() {
      if (stopped) {
        return { audio: new Blob(chunks), inlineText: null, durationMs: Date.now() - start, mimeType: recorder.mimeType }
      }
      stopped = true
      const blob = await stopAndCollect()
      stream.getTracks().forEach((t) => t.stop())
      return {
        audio: blob,
        inlineText: null,
        durationMs: Date.now() - start,
        mimeType: blob.type,
      }
    },
    async cancel() {
      stopped = true
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        /* noop */
      }
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}

function pickPreferredMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return null
}
