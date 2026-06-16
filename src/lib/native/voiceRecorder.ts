'use client'

export interface VoiceRecording {
  /** Audio Blob captured via MediaRecorder. */
  audio: Blob | null
  /** Always null — reserved for future SR integration. */
  inlineText: string | null
  /** ISO ms duration of the captured clip. */
  durationMs: number
  /** Mime type of the captured audio. */
  mimeType: string | null
}

interface RecorderHandle {
  stop(): Promise<VoiceRecording>
  cancel(): Promise<void>
  /** Normalized RMS amplitude 0–1. */
  getAmplitude(): number
}

// Module-level permission cache — survives re-renders, reset on page reload only.
let _permStatus: 'granted' | 'denied' | 'unavailable' | 'unknown' = 'unknown'

export function getMicPermissionStatus(): typeof _permStatus {
  return _permStatus
}

/**
 * Request microphone access. Uses getUserMedia (works in both browser and
 * Capacitor WKWebView/WebView). Caches the result in _permStatus.
 */
export async function requestMicPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    _permStatus = 'unavailable'
    return 'unavailable'
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    _permStatus = 'granted'
    return 'granted'
  } catch {
    _permStatus = 'denied'
    return 'denied'
  }
}

/**
 * Start capturing audio. Always uses the web MediaRecorder path so recordings
 * produce an audio blob for Groq Whisper transcription. Works in both browser
 * and Capacitor WKWebView/WebView (iOS 14.3+ / Android).
 *
 * Call requestMicPermission() before this to ensure permission is already
 * granted — getUserMedia inside this function will still request it if needed,
 * but doing so mid-hold causes a native OS dialog race on mobile.
 */
export async function startRecording(opts?: { language?: string }): Promise<RecorderHandle> {
  void opts // language unused here; Groq transcription handles it server-side
  return startWebRecording()
}

async function startWebRecording(): Promise<RecorderHandle> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available on this device')
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Recording is not supported in this browser')
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    _permStatus = 'granted'
  } catch (e) {
    _permStatus = 'denied'
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
      throw new Error(
        'Microphone access denied. Please go to Settings → Apps → Buddget → Permissions and enable Microphone.'
      )
    }
    throw e
  }

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
  // 64 kbps keeps clips small while staying well above the AAC floor — 16 kbps
  // produced garbled, often untranscribable audio on iOS (mp4/AAC).
  const recorder = new MediaRecorder(
    stream,
    mime ? { mimeType: mime, audioBitsPerSecond: 64_000 } : { audioBitsPerSecond: 64_000 },
  )
  const chunks: Blob[] = []
  const startTs = Date.now()

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  let stopped = false
  // No timeslice — iOS WKWebView fragments the mp4 when chunked, yielding an
  // invalid container. The full blob is assembled from chunks on stop() anyway,
  // and the waveform is driven by the Web Audio analyser, not ondataavailable.
  recorder.start()

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
