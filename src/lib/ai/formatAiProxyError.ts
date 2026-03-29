/** Buddget's own 429 message from /api/ai — do not label as Google quota. */
export function isBuddgetServerThrottleMessage(message: string): boolean {
  return message.includes('This server allows') && message.includes('per device')
}

/**
 * Wrap Google Gemini quota / billing errors so users know it's not Buddget "throttle per device".
 */
export function formatProxyAiErrorForUser(message: string, httpStatus: number): string {
  if (isBuddgetServerThrottleMessage(message)) return message

  const m = message.toLowerCase()
  const looksLikeGoogleQuota =
    m.includes('quota exceeded') ||
    m.includes('exceeded your current quota') ||
    m.includes('free_tier') ||
    m.includes('resource_exhausted') ||
    m.includes('generativelanguage.googleapis.com') ||
    m.includes('rate-limits') ||
    m.includes('check your plan and billing') ||
    (httpStatus === 429 && !isBuddgetServerThrottleMessage(message))

  if (looksLikeGoogleQuota) {
    return (
      "This is a Google Gemini API rate limit on your API key — it's separate from Buddget's per-device setting.\n\n" +
      'Adjusting the throttle in Admin only changes this app\'s per-IP cap. Google still applies its own limits.\n\n' +
      `Details: ${message}\n\n` +
      'What helps: wait a minute and try again, send fewer messages, or upgrade your key in Google AI Studio.'
    )
  }

  return message
}
