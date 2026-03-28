'use client'

import { AdminAiKeyStatus } from '@/components/features/admin/AdminAiKeyStatus'
import { AdminAiThrottleEditor } from '@/components/features/admin/AdminAiThrottleEditor'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'

export interface AdminAiSectionProps {
  admin: AdminPanelModel
}

/**
 * AI status, key hints, and optional request throttling for the admin dashboard.
 */
export function AdminAiSection({ admin }: AdminAiSectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <AdminAiKeyStatus config={admin.config} />
      <AdminAiThrottleEditor
        config={admin.config}
        sessionPin={admin.sessionPin}
        rateLimitingEnabled={admin.rateLimitingEnabled}
        onRateLimitingEnabled={admin.setRateLimitingEnabled}
        rateLimitMax={admin.rateLimitMax}
        onRateLimitMax={admin.setRateLimitMax}
        rateLimitWindowSec={admin.rateLimitWindowSec}
        onRateLimitWindowSec={admin.setRateLimitWindowSec}
        saveLoading={admin.saveLoading}
        saveMessage={admin.saveMessage}
        onSave={admin.saveAiRuntime}
      />
    </section>
  )
}
