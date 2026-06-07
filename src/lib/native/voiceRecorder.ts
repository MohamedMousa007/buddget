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
  /** Normalized RMS amplitude 0–1. Returns 0 on native (no PCM access). */
  getAmplitude(): number
}

export async function startRecording(opts?: { language?: string }): Promise<RecorderHandle> {
  if (isNative()) {
    try {
      return await startNativeRecording(opts?.language)
    } catch (e) {
      console.warn('[voice] native recorder failed, falling back to web', e)
    }
  }
  return startWebRecording(opts?.language)
}

async function startNativeRecording(language?: string): Promise<RecorderHandle> {
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

  const locale = language === 'ar' ? 'ar-SA' : 'en-US'

  await SR.start({
    language: locale,
    maxResults: 1,
    prompt: 'Speak your expense',
    partialResults: true,
    popup: false,
  })

  let stopped = false

  return {
    getAmplitude: () => 0,
    async stop() {
      if (stopped) return { audio: null, inlineText: transcript[0] ?? null, durationMs: 0, mimeType: null }
      stopped = true
      try { await SR.stop() } catch { /* noop */ }
      try { await listener.remove() } catch { /* noop */ }
      return {
        audio: null,
        inlineText: transcript[0] ?? null,
        durationMs: Date.now() - start,
        mimeType: null,
      }
    },
    async cancel() {
      stopped = true
      try { await SR.stop() } catch { /* noop */ }
      try { await listener.remove() } catch { /* noop */ }
    },
  }
}

async function startWebRecording(language?: string): Promise<RecorderHandle> {
  void language // Web MediaRecorder doesn't use language; transcription handles it server-side

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available on this device')
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Recording is not supported in this browser')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  // Web Audio API — amplitude visualiser
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext
  const audioCtx = new AudioCtx()
  // Android WebView starts AudioContext in 'suspended' state due to autoplay policy.
  // resume() is safe here because startWebRecording() is always called from a user gesture.
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume() } catch { /* noop — visualiser disabled but recording proceeds */ }
  }
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)
  const timeDomainData = new Uint8Array(analyser.frequencyBinCount)

  const getAmplitude = (): number => {
    analyser.getByteTimeDomainData(timeDomainData)
    let sum = 0
    for (const v of timeDomainData) {
      const s = v / 128 - 1 // 0–255 → -1..1
      sum += s * s
    }
    return Math.sqrt(sum / timeDomainData.length) // RMS, 0..1
  }

  const mime = pickPreferredMime()
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  const startTs = Date.now()

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  let stopped = false
  recorder.start(250)

  const stopAndCollect = (): Promise<Blob> =>
    new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
      if (recorder.state !== 'inactive') recorder.stop()
      else resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
    })

  const cleanup = async () => {
    stream.getTracks().forEach((t) => t.stop())
    try { await audioCtx.close() } catch { /* noop */ }
  }

  return {
    getAmplitude,
    async stop() {
      if (stopped) {
        return { audio: new Blob(chunks), inlineText: null, durationMs: Date.now() - startTs, mimeType: recorder.mimeType }
      }
      stopped = true
      const blob = await stopAndCollect()
      await cleanup()
      return { audio: blob, inlineText: null, durationMs: Date.now() - startTs, mimeType: blob.type }
    },
    async cancel() {
      stopped = true
      try { if (recorder.state !== 'inactive') recorder.stop() } catch { /* noop */ }
      await cleanup()
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
