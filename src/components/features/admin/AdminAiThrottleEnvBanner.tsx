'use client'

import type { AdminConfig } from '@/types/admin'

export function AdminAiThrottleEnvBanner({ config }: { config: AdminConfig | null }) {
  const hints = config?.ai.runtime.envHints
  if (!hints?.AI_RATE_LIMITING_ENABLED && !hints?.AI_RATE_LIMIT_MAX && !hints?.AI_RATE_LIMIT_WINDOW_MS) {
    return null
  }
  return (
    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50">
      <p className="text-xs text-amber-200/90 font-medium mb-1">Environment overrides active</p>
      <p className="text-[11px] text-amber-100/80">
        These variables in <code className="px-1 rounded bg-black/30">.env</code> override saved Admin settings until
        removed and the server restarts:
      </p>
      <ul className="text-[11px] text-amber-100/80 mt-2 font-mono-numbers space-y-0.5">
        {hints.AI_RATE_LIMITING_ENABLED ? (
          <li>AI_RATE_LIMITING_ENABLED={hints.AI_RATE_LIMITING_ENABLED}</li>
        ) : null}
        {hints.AI_RATE_LIMIT_MAX ? <li>AI_RATE_LIMIT_MAX={hints.AI_RATE_LIMIT_MAX}</li> : null}
        {hints.AI_RATE_LIMIT_WINDOW_MS ? (
          <li>AI_RATE_LIMIT_WINDOW_MS={hints.AI_RATE_LIMIT_WINDOW_MS}</li>
        ) : null}
      </ul>
    </div>
  )
}
