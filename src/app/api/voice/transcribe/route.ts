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

const EGYPT_FIRST_PROMPT = [
  'This is a budgeting voice memo recorded by a user in Egypt or the Gulf.',
  'Common currencies (in priority order): EGP (جنيه), AED, SAR, QAR, KWD, OMR, BHD, USD.',
  'Common Egyptian merchants: Talabat, Otlob, Carrefour Egypt, Spinneys Egypt, Gourmet, Seoudi, Metro Market, Uber Egypt, Careem Egypt, Breadfast, InstaShop Egypt, Mahmoud Pharmacy, El Ezaby, Cairo Festival City, Mall of Egypt, City Stars, Vodafone Cash, Fawry.',
  'Common UAE / GCC merchants: Carrefour, Lulu, Spinneys, Choithrams, Talabat UAE, Noon, Amazon.ae, ADCB, Emirates NBD.',
  'Egyptian Arabic phrases: متشكر, دفعت, اشتريت, جنيه, خصم, عملية شراء.',
  'Formats expected: "spent 250 EGP at Talabat", "دفعت ٥٠ جنيه في كافيه", "120 dirhams at Carrefour", "200 جنيه taxi to office".',
].join(' ')

export async function POST(request: NextRequest) {
  const { user } = await resolveRouteUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Voice is not configured. Admin needs to set GROQ_API_KEY.' },
      { status: 503 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const audio = form.get('audio')
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'Missing audio blob' }, { status: 400 })
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'Audio exceeds 25 MB' }, { status: 413 })
  }

  const language = (form.get('language') as string | null)?.trim() || 'en'

  try {
    const groq = new Groq({ apiKey })
    const filename = (audio as File).name || 'recording.webm'
    const file = new File([audio], filename, { type: audio.type || 'audio/webm' })

    const result = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      prompt: EGYPT_FIRST_PROMPT,
      language: language === 'ar' ? 'ar' : 'en',
      response_format: 'verbose_json',
      temperature: 0,
    })

    return NextResponse.json({
      text: result.text ?? '',
      language: (result as { language?: string }).language ?? language,
      duration: (result as { duration?: number }).duration ?? null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown transcription error'
    console.error('[voice/transcribe] failed', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
