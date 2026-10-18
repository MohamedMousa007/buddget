import { Trophy } from 'lucide-react'
import { OptionChip } from '@/components/ui/OptionChip'
import { useT } from '@/lib/i18n'

/** Companion to the All/Active/Paused switch (outside the SegmentedControl); opens the achieved view. */
export function TrophyChip({ count, pressed, onClick }: { count: number; pressed: boolean; onClick: () => void }) {
  const t = useT().goals.home
  return (
    <OptionChip size="segment" selected={pressed} onClick={onClick} aria-label={t.trophyAria(count)} className="flex-none">
      <Trophy aria-hidden className="size-[18px]" />
      <span className="font-mono-numbers font-semibold">{count}</span>
    </OptionChip>
  )
}
