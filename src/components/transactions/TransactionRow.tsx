'use client'

/**
 * The app-wide transaction/activity row — one visual for expenses, savings activity, debt
 * payments, income and dashboard feeds. A slot-based presentational primitive: each page maps
 * its own data into the slots and wraps this in `SwipeToDelete` (or an assign action). Change the
 * look here and every list changes together. Design-system rule: never hand-roll a transaction row.
 *
 * Layout (matches the expenses list): [icon column 54px] [title + subtitle] [amount + sub-line].
 */
export interface TransactionRowProps {
  /** Glyph inside the 40×40 chip (already sized ~20px). */
  icon: React.ReactNode
  iconBg?: string
  iconFg?: string
  /** Tiny label under the icon (category / tag). */
  caption?: string
  captionColor?: string
  /** Main line — text or nodes (badges allowed). */
  title: React.ReactNode
  /** Second line under the title (payment method, note, time). */
  subtitle?: React.ReactNode
  /** Signed amount, pre-formatted (e.g. "−1,200" / "+300"). */
  amount: React.ReactNode
  amountColor?: string
  /** Sub-line under the amount (≈ USD, status). */
  sub?: React.ReactNode
  onClick?: () => void
  /** Dim the row (refunded/declined/not-counted). */
  dimmed?: boolean
}

export function TransactionRow({
  icon, iconBg, iconFg, caption, captionColor, title, subtitle, amount, amountColor, sub, onClick, dimmed,
}: TransactionRowProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)]"
    >
      {/* A. Icon column */}
      <span className="flex w-[54px] shrink-0 flex-col items-center gap-[5px]">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-[11px] ${dimmed ? 'opacity-50' : ''}`}
          style={{ background: iconBg ?? 'var(--color-brand-elevated)', color: iconFg }}
        >
          {icon}
        </span>
        {caption ? (
          <span className="max-w-[54px] truncate text-center text-[9.5px] font-semibold leading-none" style={{ color: captionColor ?? 'var(--color-brand-text-muted)' }}>
            {caption}
          </span>
        ) : null}
      </span>

      {/* B. Middle column */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 overflow-hidden">
          <span className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
        </span>
        {subtitle ? (
          <span className="mt-1.5 flex items-center whitespace-nowrap font-mono-numbers text-xs font-medium text-[var(--color-brand-text-muted)]">
            {subtitle}
          </span>
        ) : null}
      </span>

      {/* C. Amount column */}
      <span className="shrink-0 text-end">
        <span className="font-mono-numbers block text-[15px] font-medium tabular-nums" style={{ color: amountColor ?? 'var(--color-brand-text-primary)' }}>
          {amount}
        </span>
        {sub ? <span className="font-mono-numbers mt-[3px] block text-[11.5px] font-medium text-[var(--color-brand-text-muted)]">{sub}</span> : null}
      </span>
    </Tag>
  )
}
