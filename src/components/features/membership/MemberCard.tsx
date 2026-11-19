import type { ReactNode } from 'react'
import { Award, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProMark } from './ProMark'

export type MemberKind = 'pro' | 'founder' | 'beta'
export type MemberState = 'active' | 'grace' | 'expired'

export interface MemberCardProps {
  kind: MemberKind
  /** `grace` rings the card in amber, `expired` greys it. Only Pro has them. */
  state?: MemberState
  /** The mark line: "PRO", "FOUNDER". */
  mark: string
  /** Founder number, already formatted ("#023"). Founder only. */
  number?: string
  /** Two small label/value pairs along the bottom edge. */
  facts?: [{ label: string; value: ReactNode; mono?: boolean }, { label: string; value: ReactNode; mono?: boolean }?]
  /** `mini` is the one-row form for the Settings hub; `full` is the card face. */
  size?: 'full' | 'mini'
  className?: string
}

const SURFACE: Record<MemberKind, string> = {
  pro: 'bg-[image:var(--member-aurora)] border-white/20',
  founder: 'bg-[image:var(--member-floor)] border-[color-mix(in_oklab,var(--member-gold-hi)_38%,transparent)]',
  beta: 'bg-[var(--color-brand-card)] border-[var(--color-brand-border-strong)] text-[var(--color-brand-text-primary)]',
}

/**
 * The membership card: Pro (teal aurora), Founder (gold on the dark floor, numbered) and Beta tester (a quiet outline). A sibling of
 * the PaymentCardCarousel face. Layout stays left-to-right in both languages, like a physical card; text runs resolve their own direction.
 */
export function MemberCard({ kind, state = 'active', mark, number, facts, size = 'full', className }: MemberCardProps) {
  const foil = 'bg-[image:var(--member-foil)] bg-clip-text text-transparent'
  const onSurface = kind === 'beta' ? 'text-[var(--color-brand-text-secondary)]' : 'text-[var(--member-fg-2)]'
  return (
    <div
      dir="ltr"
      data-kind={kind}
      data-state={state}
      className={cn(
        'relative overflow-hidden border text-start text-[var(--member-fg)]',
        SURFACE[kind],
        size === 'full' ? 'flex aspect-[1.586] w-full flex-col justify-between rounded-[20px] px-[18px] py-4 shadow-lg' : 'flex min-h-[76px] items-center gap-3 rounded-[18px] px-3.5 py-3',
        state === 'grace' && 'ring-2 ring-[var(--color-brand-amber)]',
        state === 'expired' && 'opacity-80 grayscale',
        className,
      )}
    >
      <div className={cn('flex items-center justify-between gap-2', size === 'mini' && 'contents')}>
        <span className={cn('inline-flex items-center gap-2 text-[0.6875rem] font-extrabold tracking-[0.16em]', size === 'mini' && 'order-1')}>
          {kind === 'pro' ? <ProMark size="sm" /> : kind === 'founder' ? <Crown className="size-[18px] text-[var(--member-gold-hi)]" aria-hidden /> : <Award className="size-[18px] text-[var(--color-brand-primary-ink)]" aria-hidden />}
          <span className={cn(kind === 'founder' && foil)}>{mark}</span>
        </span>
        {size === 'full' && number ? <span className={cn('font-mono-numbers text-[2.5rem] font-semibold leading-none', foil)}>{number}</span> : null}
      </div>
      {facts ? (
        <div className={cn('flex items-end justify-between gap-3', size === 'mini' && 'order-2 ms-auto')}>
          {facts.map((f, i) => f ? (
            <div key={i} dir="auto" className="min-w-0">
              <p className={cn('text-[0.625rem] font-semibold', onSurface)}>{f.label}</p>
              <p className={cn('text-sm font-semibold', f.mono !== false && 'font-mono-numbers')}>{f.value}</p>
            </div>
          ) : null)}
        </div>
      ) : null}
    </div>
  )
}
