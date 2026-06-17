/**
 * Speak a short answer aloud via the Web Speech API. Works inside the Capacitor
 * WebView (iOS/Android) and the browser. No-ops silently where unsupported so the
 * answer panel never depends on TTS being available.
 */
export function speak(text: string, lang = 'en'): void {
  try {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
    u.rate = 1
    synth.speak(u)
  } catch {
    /* TTS unavailable — degrade silently */
  }
}

export function stopSpeaking(): void {
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* noop */
  }
}
