'use client'

import { useEffect, useState } from 'react'
import { adminPost, errorMessage } from '../../adminClient'
import { dateTime, num } from '../../format'
import { DataTable, type Column } from '../../ui/DataTable'
import { Notice, Panel } from '../../ui/Panel'
import type { SmsKeywordPoolRow, SmsSenderPoolRow } from '../../types'

/** Vocabulary and senders learned from confirmed transactions, by frequency. */
export function KeywordPoolPanel() {
  const [data, setData] = useState<{ keywords: SmsKeywordPoolRow[]; senders: SmsSenderPoolRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminPost<{ keywords: SmsKeywordPoolRow[]; senders: SmsSenderPoolRow[] }>('/api/admin/sms/templates', { op: 'keyword_pool' }).then(setData).catch((e) => setError(errorMessage(e)))
  }, [])

  const senderCols: Column<SmsSenderPoolRow>[] = [
    { key: 's', header: 'Sender', cell: (r) => <span className="font-mono">{r.sender}</span> },
    { key: 'h', header: 'Hits', numeric: true, cell: (r) => num(r.hit_count) },
    { key: 't', header: 'Txns', numeric: true, cell: (r) => num(r.txn_count) },
    { key: 'l', header: 'Last seen', wide: true, cell: (r) => dateTime(r.last_seen) },
  ]
  const keywordCols: Column<SmsKeywordPoolRow>[] = [
    { key: 'k', header: 'Keyword', cell: (r) => <span className="font-mono">{r.keyword}</span> },
    { key: 'lang', header: 'Lang', cell: (r) => <span className="uppercase text-[var(--color-brand-text-muted)]">{r.lang ?? '—'}</span> },
    { key: 'h', header: 'Count', numeric: true, cell: (r) => num(r.hit_count) },
  ]

  if (error) return <Notice tone="negative">{error}</Notice>
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel flush title={`Senders${data ? ` (${data.senders.length})` : ''}`}><DataTable rows={data?.senders ?? []} columns={senderCols} rowKey={(r) => r.sender} loading={!data} /></Panel>
      <Panel flush title={`Keywords${data ? ` (${data.keywords.length})` : ''}`}><DataTable rows={data?.keywords ?? []} columns={keywordCols} rowKey={(r) => r.keyword} loading={!data} /></Panel>
    </div>
  )
}
