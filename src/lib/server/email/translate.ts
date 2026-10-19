import { applyStrings, collectStrings, validateTranslation, type Translatable } from '@/lib/email/translate'
import type { EmailLocale } from '@/lib/email/scenarios'
import { TIER_MODELS, callGemini } from '@/lib/server/ai/gemini'

const TIMEOUT_MS = 25_000

const SYSTEM = (from: string, to: string) =>
  `You translate transactional emails for Buddget, a personal-finance app, from ${from} to ${to}. ` +
  'Write what a friendly native speaker would write: warm, clear and short, never a literal word-for-word copy. ' +
  'For Arabic use simple Modern Standard Arabic that feels natural across Egypt and the Gulf. ' +
  'Keep every {{variable}} exactly as written (same spelling, braces and count). Keep the brand name Buddget in Latin letters. ' +
  'Keep line breaks, numbers and codes. Return JSON {"strings": [...]} with exactly as many strings as you were given, in the same order.'

/** Buddgy's model translates the email's text. The result is rejected unless it keeps every variable. */
export async function translateTemplate(src: Translatable, from: EmailLocale, to: EmailLocale): Promise<Translatable> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const strings = collectStrings(src)
  const res = await callGemini(
    TIER_MODELS.smart,
    apiKey,
    {
      systemInstruction: { parts: [{ text: SYSTEM(from === 'ar' ? 'Arabic' : 'English', to === 'ar' ? 'Arabic' : 'English') }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ strings }) }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', properties: { strings: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['strings'] },
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    },
    false,
    AbortSignal.timeout(TIMEOUT_MS),
  )
  if (!res.ok) throw new Error(`Translation service answered ${res.status}`)
  const payload = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  let parsed: { strings?: unknown }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The translation was not valid JSON')
  }
  if (!validateTranslation(strings, parsed.strings)) throw new Error('The translation dropped or changed a variable')
  return applyStrings(src, parsed.strings)
}
