'use client'

export function AdminAiThrottleIntro() {
  return (
    <div>
      <h3 className="text-xs font-semibold text-white mb-1">Optional: throttle users on this server</h3>
      <p className="text-[11px] text-[var(--color-brand-text-muted)] mb-3">
        <span className="text-[var(--color-brand-text-secondary)]">Off</span> = no Buddget-side limits (only you or you
        trust your users). Google&apos;s Gemini quotas still apply.{' '}
        <span className="text-[var(--color-brand-text-secondary)]">On</span> = cap how many AI calls each device (IP)
        can make per time window — useful on a shared app or to protect a tight API plan.
      </p>
      <p className="text-[11px] text-amber-200/90 mb-3 p-2 rounded-lg bg-amber-950/30 border border-amber-900/40">
        If you see &quot;quota exceeded&quot; or &quot;free_tier_requests&quot; from Google, that is{' '}
        <strong className="text-amber-100">not</strong> fixed by turning throttling off here — that message is from
        Google&apos;s API (e.g. ~20 RPM on free tier). Wait, send fewer chats, or add billing in Google AI Studio.
      </p>
      <a
        href="https://ai.google.dev/gemini-api/docs/rate-limits"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-[var(--color-brand-red)] hover:underline"
      >
        Gemini API limits (Google) →
      </a>
    </div>
  )
}
