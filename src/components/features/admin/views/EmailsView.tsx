'use client'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAdminQuery } from '../adminClient'
import { adminNavigate, useAdminRoute } from '../adminRouter'
import { EmailEditor } from '../emails/EmailEditor'
import { EmailList } from '../emails/EmailList'
import { EmailLog } from '../emails/EmailLog'
import type { ScenarioSummary } from '../emails/types'
import { PageHeader } from '../ui/Panel'
import type { AdminStatus } from '../types'

export default function EmailsView({ status }: { status: AdminStatus }) {
  const { params } = useAdminRoute()
  const canManage = (status.permissions ?? []).some((p) => p === '*' || p === 'emails.manage')
  const list = useAdminQuery<{ scenarios: ScenarioSummary[] }>(params.key ? null : '/api/admin/emails')
  const tab = params.tab === 'log' ? 'log' : 'templates'

  if (params.key) return <EmailEditor key={params.key} scenarioKey={params.key} canManage={canManage} onBack={() => adminNavigate('emails')} />

  return (
    <>
      <PageHeader title="Emails" description="Create and manage every transactional email Buddget sends, in English and Arabic." />
      <div className="mb-4 max-w-sm">
        <SegmentedControl
          ariaLabel="Emails section"
          value={tab}
          onChange={(t) => adminNavigate('emails', t === 'log' ? { tab: 'log' } : {}, { replace: true })}
          options={[{ value: 'templates', label: 'Templates' }, { value: 'log', label: 'Send log' }]}
        />
      </div>
      {tab === 'log'
        ? <EmailLog scenarios={list.data?.scenarios ?? []} />
        : <EmailList canManage={canManage} onOpen={(key) => adminNavigate('emails', { key })} />}
    </>
  )
}
