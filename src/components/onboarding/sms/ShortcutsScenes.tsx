import type { ReactNode } from 'react'
import { Check, ChevronRight, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Illustrated stand-ins for the iOS Shortcuts screens, drawn in Buddget's own tokens. Apple's labels are kept in English on
 * purpose: they are Apple's words for its own UI, and what the reader must match on their phone.
 */
export type SceneId = 'automationTab' | 'pickMessage' | 'messageContains' | 'runImmediately' | 'searchAction' | 'shortcutInput'

/** The one thing to tap: a teal ring that breathes (still when the reader prefers reduced motion). */
function Focus({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('relative block rounded-xl ring-2 ring-[var(--color-brand-primary)] ring-offset-2 ring-offset-[var(--color-brand-card)] motion-safe:animate-pulse', className)}>
      {children}
    </span>
  )
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3 shadow-[var(--shadow-md)]">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-brand-border-strong)]" aria-hidden />
      {children}
    </div>
  )
}

const Row = ({ label, value, chevron = true }: { label: string; value?: string; chevron?: boolean }) => (
  <div className="flex min-h-11 items-center gap-2 px-3.5 text-[15px] text-[var(--color-brand-text-primary)]">
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {value ? <span className="text-[var(--color-brand-text-muted)]">{value}</span> : null}
    {chevron ? <ChevronRight className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden /> : null}
  </div>
)

const Group = ({ children }: { children: ReactNode }) => (
  <div className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl bg-[var(--color-brand-elevated)]">{children}</div>
)

const Title = ({ children }: { children: ReactNode }) => <p className="mb-2.5 px-1 text-[19px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{children}</p>

/** Buddget's mark as Shortcuts shows it next to the action. */
const BuddgetIcon = () => (
  <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-brand-primary)] text-[14px] font-extrabold leading-none text-[var(--color-brand-on-primary)]" aria-hidden>B</span>
)

const SCENES: Record<SceneId, () => ReactNode> = {
  automationTab: () => (
    <Phone>
      <div className="mb-2 flex items-center justify-between px-1">
        <Title>Automation</Title>
        <Focus className="-mt-2.5"><span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]"><Plus className="size-5" aria-hidden /></span></Focus>
      </div>
      <div className="rounded-2xl bg-[var(--color-brand-elevated)] px-4 py-8 text-center text-sm text-[var(--color-brand-text-muted)]">New Automation</div>
      <div className="mt-3 grid grid-cols-3 gap-1 border-t border-[var(--color-brand-border)] pt-2 text-center text-[10.5px] font-medium text-[var(--color-brand-text-muted)]">
        <span className="py-1.5">Shortcuts</span>
        <Focus className="py-1.5 font-bold text-[var(--color-brand-primary-ink)]">Automation</Focus>
        <span className="py-1.5">Gallery</span>
      </div>
    </Phone>
  ),
  pickMessage: () => (
    <Phone>
      <Title>New Automation</Title>
      <Group>
        <Row label="Time of Day" />
        <Row label="Email" />
        <Focus className="rounded-none"><Row label="Message" /></Focus>
        <Row label="Wi-Fi" />
        <Row label="Bluetooth" />
      </Group>
    </Phone>
  ),
  messageContains: () => (
    <Phone>
      <Title>When I Get a Message</Title>
      <Group>
        <Row label="Sender" value="Any" />
        <Focus className="rounded-none">
          <div className="flex min-h-11 items-center gap-2 px-3.5 text-[15px]">
            <span className="flex-1 text-[var(--color-brand-text-primary)]">Message Contains</span>
            <span className="rounded-md bg-[var(--color-brand-primary-soft)] px-2 py-0.5 font-mono-numbers text-sm font-bold text-[var(--color-brand-primary-ink)]">EGP</span>
          </div>
        </Focus>
      </Group>
      <p className="mt-2.5 px-1 text-xs text-[var(--color-brand-text-muted)]">Leave Sender on Any.</p>
    </Phone>
  ),
  runImmediately: () => (
    <Phone>
      <Title>{"When I Get a Message Containing 'EGP'"}</Title>
      <Group>
        <Row label="Run After Confirmation" chevron={false} />
        <Focus className="rounded-none">
          <div className="flex min-h-11 items-center gap-2 px-3.5 text-[15px] font-semibold text-[var(--color-brand-text-primary)]">
            <span className="flex-1">Run Immediately</span>
            <Check className="size-4 text-[var(--color-brand-primary-ink)]" aria-hidden />
          </div>
        </Focus>
      </Group>
      <div className="mt-3 flex justify-end"><span className="rounded-full bg-[var(--color-brand-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--color-brand-on-primary)]">Next</span></div>
    </Phone>
  ),
  searchAction: () => (
    <Phone>
      <div className="mb-2.5 flex items-center gap-2 rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2.5 text-[15px] text-[var(--color-brand-text-primary)]">
        <Search className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />Catch
      </div>
      <Focus>
        <div className="flex min-h-12 items-center gap-3 rounded-xl bg-[var(--color-brand-elevated)] px-3">
          <BuddgetIcon />
          <span className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">Catch Bank SMS</span>
        </div>
      </Focus>
    </Phone>
  ),
  shortcutInput: () => (
    <Phone>
      <Group>
        <Row label="Receive messages as input" chevron={false} />
        <div className="flex min-h-14 flex-wrap items-center gap-2 px-3.5 py-2 text-[15px] text-[var(--color-brand-text-primary)]">
          <BuddgetIcon />
          <span>Catch</span>
          <Focus className="inline-block"><span className="rounded-md bg-[var(--color-brand-primary-soft)] px-2 py-0.5 font-semibold text-[var(--color-brand-primary-ink)]">Shortcut Input</span></Focus>
        </div>
      </Group>
      <p className="mt-2.5 px-1 text-xs text-[var(--color-brand-text-muted)]">Bank Message → Shortcut Input. That is the whole message.</p>
    </Phone>
  ),
}

export function ShortcutsScene({ id }: { id: SceneId }) {
  return <>{SCENES[id]()}</>
}
