const STOCK_HALLUCINATIONS = ['thanks for watching', 'thank you for watching', 'thank you', 'شكرا على المشاهدة', 'شكرا لمشاهدتكم', 'اشتركوا في القناة']
const MIN_ECHO_CHARS = 8
const MIN_CHARS = 3

const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Whisper returns its prompt (or a stock phrase) for silence and noise; such text must never reach the expense extractor. */
export function isPhantomTranscript(text: string, prompt: string): boolean {
  const t = normalise(text)
  if (t.length < MIN_CHARS) return true
  if (STOCK_HALLUCINATIONS.includes(t)) return true
  return t.length >= MIN_ECHO_CHARS && normalise(prompt).includes(t)
}
