import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { BLOCK_META } from '@/lib/budget/blocks'
import { lineToneCategory } from '@/lib/budget/lineTone'
import type { BudgetBlock, BudgetPlanCategory } from '@/lib/store/types'
import { cn } from '@/lib/utils'
import { LineIcon } from './LineIcon'
import { TintedTile } from './TintedTile'

/**
 * A budget line's tile (Light touch `page-budget`, `s_line`): the category's own icon and tone (house, food, plug),
 * as Flow rows show them. A line with no known category keeps its own icon on the block tint.
 */
export function LineTile({ line, block, className }: { line: Pick<BudgetPlanCategory, 'name' | 'icon' | 'expenseCategories'>; block: BudgetBlock; className?: string }) {
  const cat = lineToneCategory(line)
  if (!cat) return <TintedTile cat={BLOCK_META[block].cat} className={className}><LineIcon name={line.icon} /></TintedTile>
  const { fg, bg } = categoryChipColors(cat)
  return (
    <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-[14px]', className)} style={{ color: fg, background: bg }}>
      <CategoryIcon category={cat} className="size-[22px]" />
    </span>
  )
}
