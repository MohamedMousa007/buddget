/**
 * Voice pipeline observability. Every voice command moves through fixed stages;
 * tagging each one makes failures pinpointable from the client console (Android
 * logcat: tag `Capacitor/Console`) and lets the UI name the exact step that broke
 * instead of a generic "something went wrong".
 */
export type VoiceStage = 'record' | 'transcribe' | 'extract' | 'validate' | 'apply'

type StageStatus = 'start' | 'ok' | 'fail'

/** Human label for the failed stage, shown to the user as a prefix. */
const STAGE_LABEL: Record<VoiceStage, string> = {
  record: 'Recording',
  transcribe: 'Transcription',
  extract: 'Understanding',
  validate: 'Checking',
  apply: 'Saving',
}

export function voiceStageLabel(stage: VoiceStage): string {
  return STAGE_LABEL[stage]
}

/** One structured breadcrumb per stage transition. `[VOICE:transcribe] ok latency=820ms` */
export function logVoiceStage(stage: VoiceStage, status: StageStatus, detail?: string): void {
  const line = `[VOICE:${stage}] ${status}${detail ? ` ${detail}` : ''}`
  if (status === 'fail') console.error(line)
  else console.info(line)
}

/** Failure that knows which stage produced it and what to tell the user. */
export class VoiceStageError extends Error {
  readonly stage: VoiceStage
  readonly userMessage: string
  constructor(stage: VoiceStage, userMessage: string, cause?: unknown) {
    super(`[${stage}] ${userMessage}`)
    this.name = 'VoiceStageError'
    this.stage = stage
    this.userMessage = userMessage
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
  }
}

/**
 * Wrap a stage: logs start/ok/fail with latency and rethrows non-abort failures as
 * a `VoiceStageError` carrying a stage-named user message. Abort errors pass through
 * untouched so `cancel()` stays silent.
 */
export async function runStage<T>(
  stage: VoiceStage,
  userFailMessage: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now()
  logVoiceStage(stage, 'start')
  try {
    const result = await fn()
    logVoiceStage(stage, 'ok', `latency=${Date.now() - started}ms`)
    return result
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    if (e instanceof VoiceStageError) {
      logVoiceStage(stage, 'fail', `latency=${Date.now() - started}ms err=${e.userMessage}`)
      throw e
    }
    const detail = e instanceof Error ? e.message : String(e)
    logVoiceStage(stage, 'fail', `latency=${Date.now() - started}ms err=${detail}`)
    throw new VoiceStageError(stage, `${STAGE_LABEL[stage]} step — ${userFailMessage}`, e)
  }
}
