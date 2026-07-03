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
import { NextResponse, type NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { audioMimeToExt } from '@/lib/voice/audioMime'

export const maxDuration = 30

const EGYPT_FIRST_PROMPT = [
  'This is a budgeting voice memo recorded by a user in Egypt or the Gulf.',
  'Common currencies (in priority order): EGP (جنيه), AED, SAR, QAR, KWD, OMR, BHD, USD.',
  'Common Egyptian merchants: Talabat, Otlob, Carrefour Egypt, Spinneys Egypt, Gourmet, Seoudi, Metro Market, Uber Egypt, Careem Egypt, Breadfast, InstaShop Egypt, Mahmoud Pharmacy, El Ezaby, Cairo Festival City, Mall of Egypt, City Stars, Vodafone Cash, Fawry.',
  'Common UAE / GCC merchants: Carrefour, Lulu, Spinneys, Choithrams, Talabat UAE, Noon, Amazon.ae, ADCB, Emirates NBD.',
  'Egyptian Arabic phrases: متشكر, دفعت, اشتريت, جنيه, خصم, عملية شراء.',
  'Formats expected: "spent 250 EGP at Talabat", "دفعت ٥٠ جنيه في كافيه", "120 dirhams at Carrefour", "200 جنيه taxi to office".',
].join(' ')

export async function POST(request: NextRequest) {
  const started = Date.now()
  const { user } = await resolveRouteUser(request)
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
  let language: string
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    let body: { audio?: string; mimeType?: string; language?: string }
    try {
      body = await request.json() as { audio?: string; mimeType?: string; language?: string }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body.audio) return NextResponse.json({ error: 'Missing audio field' }, { status: 400 })
    const buffer = Buffer.from(body.audio, 'base64')
    if (buffer.byteLength > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio exceeds 25 MB' }, { status: 413 })
    }
    audio = new Blob([buffer], { type: body.mimeType || 'audio/mp4' })
    language = body.language?.trim() || 'en'
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
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio exceeds 25 MB' }, { status: 413 })
    }
    audio = file
    language = (form.get('language') as string | null)?.trim() || 'en'
  }

  try {
    const groq = new Groq({ apiKey })
    const type = audio.type || 'audio/mp4'
    const file = new File([audio], `recording.${audioMimeToExt(type)}`, { type })

    // `json` (not `verbose_json`) — we only read `.text`; smaller response payload.
    const transcribe = () => groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      prompt: EGYPT_FIRST_PROMPT,
      language: language === 'ar' ? 'ar' : 'en',
      response_format: 'json',
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

    console.info(`[VOICE:transcribe] ok user=${user.id} latency=${Date.now() - started}ms bytes=${audio.size}`)
    return NextResponse.json({
      text: result.text ?? '',
      language: (result as { language?: string }).language ?? language,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown transcription error'
    console.error(`[VOICE:transcribe] fail status=502 user=${user.id} latency=${Date.now() - started}ms err=${msg}`)
    return NextResponse.json({ error: msg, stage: 'transcribe' }, { status: 502 })
  }
}
