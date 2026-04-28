export type OnboardingFeedbackContext = 'budget_preview_regenerate' | 'budget_preview_note'

export async function submitOnboardingFeedback(args: {
  context: OnboardingFeedbackContext
  body: string
  metadata?: Record<string, unknown>
}): Promise<{ ok: boolean; error?: string }> {
  const trimmed = args.body.trim()
  if (!trimmed) return { ok: true }

  try {
    const res = await fetch('/api/onboarding/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: args.context,
        body: trimmed,
        metadata: args.metadata ?? {},
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, error: t.slice(0, 200) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
}
