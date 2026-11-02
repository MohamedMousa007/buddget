/**
 * POST /api/voice/transcribe
 *
 * Receives a short audio recording (multipart/form-data, field `audio`) and
 * returns a transcription via Groq's Whisper Large v3.
 *
 * Egypt-first prompt: tuned to recognise EGP / جنيه + Egyptian merchants
 * (Talabat, Otlob, Carrefour Egypt, Spinneys Egypt, Gourmet, Seoudi, Metro
 * Market, Uber Egypt, Careem Egypt) before UAE / wider GCC vocabulary.
 *
 * Auth: Supabase session required (matches `/api/ai`).
 */
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse, type NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import { resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'
import { quotaDeniedResponse, reserveAiQuota, settleAiQuota } from '@/lib/server/ai/quota'
import { audioMimeToExt } from '@/lib/voice/audioMime'
import { isPhantomTranscript } from '@/lib/voice/whisperEcho'

export const maxDuration = 30

const EGYPT_FIRST_PROMPT = [
  'This is a budgeting voice memo recorded by a user in Egypt or the Gulf.',
  'Common currencies (in priority order): EGP (جنيه), AED, SAR, QAR, KWD, OMR, BHD, USD.',
  'Common Egyptian merchants: Talabat, Otlob, Carrefour Egypt, Spinneys Egypt, Gourmet, Seoudi, Metro Market, Uber Egypt, Careem Egypt, Breadfast, InstaShop Egypt, Mahmoud Pharmacy, El Ezaby, Cairo Festival City, Mall of Egypt, City Stars, Vodafone Cash, Fawry.',
  'Common UAE / GCC merchants: Carrefour, Lulu, Spinneys, Choithrams, Talabat UAE, Noon, Amazon.ae, ADCB, Emirates NBD.',
  'Egyptian Arabic phrases: متشكر, دفعت, اشتريت, جنيه, خصم, عملية شراء.',
].join(' ')

/** Whisper's own silence score above this means the clip had no speech. */
const NO_SPEECH_PROB = 0.6

/** A spoken expense is seconds long; anything past this is not one. */
/** Base64 in JSON inflates 4/3 and Vercel rejects bodies over 4.5 MB before this code runs, so stay under it. */
const MAX_AUDIO_BYTES = 3_300_000
/** Audio is billed by length, not tokens: one unit per ~20 bytes keeps it on the same wheel. */
const BYTES_PER_UNIT = 20
/** A hung upstream must fail inside the function budget so the quota reservation is settled. */
const GROQ_TIMEOUT_MS = 12_000

export async function POST(request: NextRequest) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const started = Date.now()
  const user = await resolveRouteIdentity(request)
  if (!user) {
    console.error('[VOICE:transcribe] fail status=401 reason=unauthorized')
    return NextResponse.json({ error: 'Unauthorized', stage: 'transcribe' }, { status: 401 })
  }

  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    console.error(`[VOICE:transcribe] fail status=503 user=${user.id} reason=no_groq_key`)
    return NextResponse.json(
      { error: 'Voice is not configured. Admin needs to set GROQ_API_KEY.', stage: 'transcribe' },
      { status: 503 },
    )
  }

  let audio: Blob
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    let body: { audio?: string; mimeType?: string }
    try {
      body = await request.json() as { audio?: string; mimeType?: string }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body.audio) return NextResponse.json({ error: 'Missing audio field' }, { status: 400 })
    const buffer = Buffer.from(body.audio, 'base64')
    if (buffer.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio too large', stage: 'transcribe' }, { status: 413 })
    }
    audio = new Blob([buffer], { type: body.mimeType || 'audio/mp4' })
  } else {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
    const file = form.get('audio')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing audio blob' }, { status: 400 })
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio too large', stage: 'transcribe' }, { status: 413 })
    }
    audio = file
  }

  const units = Math.round(audio.size / BYTES_PER_UNIT)
  const quota = await reserveAiQuota({ userId: user.id, feature: 'voice', estUnits: units })
  if (!quota.allowed) return quotaDeniedResponse(quota)
  const spent = (status: 'ok' | 'error') =>
    settleAiQuota(quota, { model: 'whisper-large-v3', tier: 'transcribe', latencyMs: Date.now() - started, usage: { promptTokens: units, cachedTokens: 0, outputTokens: 0 }, status })

  try {
    const groq = new Groq({ apiKey, timeout: GROQ_TIMEOUT_MS, maxRetries: 0 })
    const type = audio.type || 'audio/mp4'
    const file = new File([audio], `recording.${audioMimeToExt(type)}`, { type })

    // Language is left to Whisper's auto-detect: the UI locale says nothing about the language spoken.
    const transcribe = () => groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      prompt: EGYPT_FIRST_PROMPT,
      response_format: 'verbose_json',
      temperature: 0,
    })

    let result: Awaited<ReturnType<typeof transcribe>>
    try {
      result = await transcribe()
    } catch (err) {
      // Retry once on rate limit, server errors, or connection failures (no status).
      const status = (err as { status?: number }).status
      const retryable = status === undefined || status === 429 || status >= 500
      if (!retryable) throw err
      await new Promise((r) => setTimeout(r, 500))
      result = await transcribe()
    }

    await spent('ok')
    console.info(`[VOICE:transcribe] ok user=${user.id} latency=${Date.now() - started}ms bytes=${audio.size}`)
    const { language, segments } = result as { language?: string; segments?: { no_speech_prob?: number }[] }
    const silent = Boolean(segments?.length) && segments!.every((g) => (g.no_speech_prob ?? 0) > NO_SPEECH_PROB)
    const text = result.text ?? ''
    return NextResponse.json({ text: silent || isPhantomTranscript(text, EGYPT_FIRST_PROMPT) ? '' : text, language })
  } catch (err) {
    await spent('error')
    const msg = err instanceof Error ? err.message : 'Unknown transcription error'
    console.error(`[VOICE:transcribe] fail status=502 user=${user.id} latency=${Date.now() - started}ms err=${msg}`)
    return NextResponse.json({ error: msg, stage: 'transcribe' }, { status: 502 })
  }
}
