'use client'

import type { AdminConfig } from '@/types/admin'
import { AdminAiThrottleIntro } from '@/components/features/admin/AdminAiThrottleIntro'
import { AdminAiThrottleEnvBanner } from '@/components/features/admin/AdminAiThrottleEnvBanner'
import { AdminAiThrottleInputs } from '@/components/features/admin/AdminAiThrottleInputs'
import { AdminAiThrottlePresets } from '@/components/features/admin/AdminAiThrottlePresets'
import { AdminAiThrottleFooter } from '@/components/features/admin/AdminAiThrottleFooter'

export interface AdminAiThrottleEditorProps {
  config: AdminConfig | null
  sessionPin: string
  rateLimitingEnabled: boolean
  onRateLimitingEnabled: (v: boolean) => void
  rateLimitMax: number
  onRateLimitMax: (v: number) => void
  rateLimitWindowSec: number
  onRateLimitWindowSec: (v: number) => void
  saveLoading: boolean
  saveMessage: string
  onSave: () => void
}

/** Per-device AI throttling controls and persistence to server config file. */
export function AdminAiThrottleEditor({
  config,
  sessionPin,
  rateLimitingEnabled,
  onRateLimitingEnabled,
  rateLimitMax,
  onRateLimitMax,
  rateLimitWindowSec,
  onRateLimitWindowSec,
  saveLoading,
  saveMessage,
  onSave,
}: AdminAiThrottleEditorProps) {
  return (
    <div className="pt-2 border-t border-[var(--color-brand-border)] space-y-4">
      <AdminAiThrottleIntro />
      <AdminAiThrottleEnvBanner config={config} />
      <AdminAiThrottleInputs
        rateLimitingEnabled={rateLimitingEnabled}
        onRateLimitingEnabled={onRateLimitingEnabled}
        rateLimitMax={rateLimitMax}
        onRateLimitMax={onRateLimitMax}
        rateLimitWindowSec={rateLimitWindowSec}
        onRateLimitWindowSec={onRateLimitWindowSec}
      />
      <AdminAiThrottlePresets
        onRateLimitingEnabled={onRateLimitingEnabled}
        onRateLimitMax={onRateLimitMax}
        onRateLimitWindowSec={onRateLimitWindowSec}
      />
      <AdminAiThrottleFooter
        config={config}
        sessionPin={sessionPin}
        saveLoading={saveLoading}
        saveMessage={saveMessage}
        onSave={onSave}
      />
    </div>
  )
}
