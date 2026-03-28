'use client'

/**
 * Static env-var reference for operators.
 */
export function AdminHelpSection() {
  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-3">
        Configuration Guide
      </h2>
      <div className="text-xs text-[var(--color-brand-text-muted)] space-y-2">
        <p>
          All admin configuration is managed via environment variables in{' '}
          <code className="text-[var(--color-brand-red)]">.env.local</code>:
        </p>
        <div className="p-3 rounded-lg bg-[var(--color-brand-bg)] font-mono-numbers space-y-1 text-[11px]">
          <p>
            <span className="text-[var(--color-brand-text-secondary)]">GEMINI_API_KEY</span>=
            <span className="text-[var(--color-brand-green)]">your_key_here</span>
          </p>
          <p>
            <span className="text-[var(--color-brand-text-secondary)]">ADMIN_PIN</span>=
            <span className="text-[var(--color-brand-green)]">your_pin</span>
          </p>
          <p className="text-[var(--color-brand-text-muted)] pt-1 border-t border-[var(--color-brand-border)] mt-2">
            Supabase (multi-user):
          </p>
          <p>
            <span className="text-[var(--color-brand-text-secondary)]">NEXT_PUBLIC_SUPABASE_URL</span>
          </p>
          <p>
            <span className="text-[var(--color-brand-text-secondary)]">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
          </p>
          <p>
            <span className="text-[var(--color-brand-text-secondary)]">SUPABASE_SERVICE_ROLE_KEY</span>{' '}
            <span className="text-[var(--color-brand-text-muted)]">(server only)</span>
          </p>
          <p className="text-[var(--color-brand-text-muted)] pt-1 border-t border-[var(--color-brand-border)] mt-2">
            Optional throttling (override Admin file / serverless):
          </p>
          <p>
            <span className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMITING_ENABLED</span>=
            <span className="text-[var(--color-brand-green)]">true|false</span>
          </p>
          <p>
            <span className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMIT_MAX</span>=
            <span className="text-[var(--color-brand-green)]">15</span>
          </p>
          <p>
            <span className="text-[var(--color-brand-text-secondary)]">AI_RATE_LIMIT_WINDOW_MS</span>=
            <span className="text-[var(--color-brand-green)]">60000</span>
          </p>
        </div>
        <p>After changing env vars, restart the server for changes to take effect.</p>
      </div>
    </section>
  )
}
