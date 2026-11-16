import { quotaDeniedMessage } from '@/lib/ai/quotaDeniedCopy'
import { onLimitDenied } from '@/lib/usage/onLimitDenied'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { logVoiceStage, VoiceStageError } from '@/lib/voice/voiceStages'

/**
 * Decodes the current Supabase access token on the device and reports why a 401/403 happened (missing, expired,
 * unreadable), so the failure is actionable from the device.
 */
async function diagnoseAuth(status: number): Promise<{ message: string; hasToken: boolean }> {
  let message: string
  let hasToken = false
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const { data: { session }, error } = await createClient().auth.getSession()
    const tok = session?.access_token
    if (!tok) {
      message = `no session token on device — sign in again. (getSession err=${error?.message ?? 'none'})`
    } else {
      hasToken = true
      let b64 = tok.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/') ?? ''
      b64 += '='.repeat((4 - (b64.length % 4)) % 4)
      const p = JSON.parse(atob(b64)) as { exp?: number }
      const expMs = (p.exp ?? 0) * 1000
      message = expMs < Date.now() ? 'your session expired — sign in again.' : 'token looks valid; please retry.'
    }
  } catch {
    message = 'could not verify your session — sign in again.'
  }
  logVoiceStage('transcribe', 'fail', `auth=${status} ${message}`)
  return { message, hasToken }
}

export interface TranscribeErrors {
  tooLarge: string
  transcriptionFailed: (status: number) => string
}

/**
 * POSTs the audio to the transcribe route (base64 JSON bypasses CapacitorHttp header stripping) and returns the text.
 * Shared by the voice sheet and the chat mic. A spent limit goes through the one billing denial handler.
 */
export async function transcribeAudio(args: {
  audio: Blob
  mimeType: string | null
  signal: AbortSignal
  accessToken?: string | null
  errors: TranscribeErrors
}): Promise<string> {
  const { audio, mimeType, signal, accessToken, errors } = args
  const mime = audio.type || mimeType || 'audio/mp4'
  const bytes = new Uint8Array(await audio.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)))
  const language = useFinanceStore.getState().settings.language === 'ar' ? 'ar' : 'en'
  const body = JSON.stringify({ audio: btoa(binary), mimeType: mime, language })

  const { apiFetchAuth } = await import('@/lib/apiBase')
  const headers: HeadersInit = accessToken
    ? { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
  const res = await apiFetchAuth('/api/voice/transcribe', { method: 'POST', body, signal, headers })

  if (!res.ok) {
    if (res.status === 413) throw new VoiceStageError('transcribe', errors.tooLarge)
    const err = (await res.json().catch(() => null)) as { error?: string; stage?: string; layer?: string; resetAt?: string | null } | null
    if (err?.stage === 'quota') {
      onLimitDenied(err.layer, err.resetAt)
      throw new VoiceStageError('transcribe', quotaDeniedMessage(err.layer, err.resetAt, language))
    }
    if (res.status === 401 || res.status === 403) {
      const diag = await diagnoseAuth(res.status)
      if (!diag.hasToken) {
        try {
          const { createClient } = await import('@/lib/supabase/client')
          await createClient().auth.signOut({ scope: 'local' })
        } catch { /* noop */ }
      }
      throw new VoiceStageError('transcribe', diag.message)
    }
    throw new VoiceStageError('transcribe', err?.error || errors.transcriptionFailed(res.status))
  }
  const data = (await res.json()) as { text?: string }
  return data.text?.trim() ?? ''
}
