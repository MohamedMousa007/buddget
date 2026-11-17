'use client'

import { Switch } from '@/components/ui/switch'
import { SWITCH_PERMISSION, type RewardsSwitch } from '@/lib/admin/rewardsOps'
import { useAdminQuery } from '../adminClient'
import { ago } from '../format'
import { useAdminAction } from '../useAdminAction'
import { Loading, Notice, Panel } from '../ui/Panel'

const COPY: Record<RewardsSwitch, { label: string; on: string; off: string }> = {
  billing: { label: 'Billing (Pro and Sparks purchases)', on: 'Turn billing back on? Paywalls and purchases come back for everyone.', off: 'Turn billing off? Paywalls and purchases disappear for everyone; existing Pro stays.' },
  tiers: { label: 'Loyalty tiers', on: 'Turn tiers on? Every unlocked tier is recomputed from points.', off: 'Turn tiers off? Tier badges disappear and every unlocked tier is cleared.' },
  referrals: { label: 'Invites and invite rewards', on: 'Turn invites on? Codes can be redeemed and rewards paid again.', off: 'Turn invites off? New codes stop working and no rewards are paid.' },
  spark_gifts: { label: 'Spark gifts on tier-up', on: 'Turn tier Spark gifts on?', off: 'Turn tier Spark gifts off? Reaching a tier no longer gives Sparks.' },
}

/** The four kill switches for Pro, tiers, invites and tier Spark gifts. Each needs its own permission and a confirm. */
export function RewardsSwitchesPanel({ can }: { can: (p: string) => boolean }) {
  const { data, error, refresh } = useAdminQuery<{ switches: Array<{ key: RewardsSwitch; enabled: boolean; updatedAt: string | null }> }>('/api/admin/rewards/switches')
  const { run, busy } = useAdminAction('/api/admin/rewards/switches', refresh)
  return (
    <Panel title="Platform switches" description="Each change applies to every user at once and is written to the audit log.">
      {error && !data ? <Notice tone="negative">{error}</Notice> : !data ? <Loading rows={4} /> : (
        <ul className="divide-y divide-[var(--color-brand-border)]">
          {data.switches.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-brand-text-primary)]">{COPY[s.key].label}</p>
                <p className="text-xs text-[var(--color-brand-text-muted)]">{s.enabled ? 'On' : 'Off'}{s.updatedAt ? ` · changed ${ago(s.updatedAt)}` : ''}</p>
              </div>
              <Switch size="touch" aria-label={COPY[s.key].label} checked={s.enabled} disabled={!can(SWITCH_PERMISSION[s.key]) || busy === s.key}
                onCheckedChange={(next: boolean) => void run(s.key, { key: s.key, enabled: next }, { success: `${COPY[s.key].label}: ${next ? 'on' : 'off'}`, confirm: { title: next ? COPY[s.key].on : COPY[s.key].off, destructive: !next, confirmLabel: next ? 'Turn on' : 'Turn off' } })} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
