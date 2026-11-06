import { BuddgyIcon, type BuddgyMood } from '@/components/ai/BuddgyIcon'
import { microClassName } from '@/lib/ui/microLabelStyle'

/** The Buddgy mark, a small label, and the page title that open every card of the budget builder. */
export function StudioHeading({ mood, label, title, hint }: { mood: BuddgyMood; label: string; title: string; hint?: string }) {
  return (
    <>
      <div className="flex items-end gap-3">
        <BuddgyIcon mood={mood} size={44} />
        <p className={`${microClassName} pb-1`}>{label}</p>
      </div>
      <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{title}</h2>
      {hint ? <p className="text-[0.84375rem] text-[var(--color-brand-text-secondary)]">{hint}</p> : null}
    </>
  )
}
