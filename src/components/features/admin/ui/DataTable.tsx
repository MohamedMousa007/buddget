'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { Loading } from './Panel'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
  /** Right-align numeric columns. */
  numeric?: boolean
  /** Hidden below `lg`; the mobile card shows only `primary`/`secondary`. */
  wide?: boolean
}

/**
 * Dense desktop table that collapses to stacked cards below `md`. Rows are whole-row clickable when `onRowClick`
 * is set; the first column should then carry the human-readable identity of the row.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  loading,
  empty,
  mobileCard,
}: {
  rows: readonly T[]
  columns: readonly Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  empty?: ReactNode
  /** Custom card for narrow screens. Defaults to the first two columns. */
  mobileCard?: (row: T) => ReactNode
}) {
  if (loading && rows.length === 0) return <div className="p-5"><Loading rows={5} /></div>
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-brand-border)] text-start">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]',
                    c.numeric ? 'text-end' : 'text-start',
                    c.wide && 'hidden xl:table-cell',
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-brand-border)]">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer transition-colors hover:bg-[var(--color-brand-elevated)]/60')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle', c.numeric && 'text-end font-mono-numbers tabular-nums', c.wide && 'hidden xl:table-cell', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[var(--color-brand-border)] md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            {onRowClick ? (
              <button type="button" data-raw-button-ok="a whole-row tap target in the admin list" onClick={() => onRowClick(row)} className="block min-h-[56px] w-full px-4 py-3 text-start active:bg-[var(--color-brand-elevated)]">
                {mobileCard ? mobileCard(row) : <DefaultCard row={row} columns={columns} />}
              </button>
            ) : (
              <div className="px-4 py-3">{mobileCard ? mobileCard(row) : <DefaultCard row={row} columns={columns} />}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function DefaultCard<T>({ row, columns }: { row: T; columns: readonly Column<T>[] }) {
  const [first, second, third] = columns
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-[var(--color-brand-text-primary)]">{first?.cell(row)}</div>
      {second ? <div className="text-xs text-[var(--color-brand-text-secondary)]">{second.cell(row)}</div> : null}
      {third ? <div className="text-xs text-[var(--color-brand-text-muted)]">{third.cell(row)}</div> : null}
    </div>
  )
}
