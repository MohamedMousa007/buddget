import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The hero of a membership page: a rounded band under the page chrome, drawn on the Pro aurora or the Founder floor.
 * HeroBand's fixed 190px number-and-scale skeleton cannot hold a sentence, a proof strip and a button, so this is its sibling for text-led pages.
 */
export function MembershipHero({ tone, children, className }: { tone: 'pro' | 'founder'; children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-3xl px-4 pb-5 pt-5 text-[var(--member-fg)]',
        tone === 'pro' ? 'bg-[image:var(--member-aurora)]' : 'bg-[image:var(--member-floor)]',
        className,
      )}
    >
      {children}
    </section>
  )
}

/** A figure on the hero: the proof strip cell. Same shape as StatTile's compact form, in the hero's translucent white. */
export function HeroStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] border border-[var(--member-line)] bg-[var(--member-cell)] px-2.5 pb-2.5 pt-2.5">
      <span dir="ltr" className="font-mono-numbers text-xl font-semibold">{value}</span>
      <span dir="auto" className="text-[0.6875rem] leading-tight text-[var(--member-fg-2)]">{label}</span>
    </div>
  )
}
