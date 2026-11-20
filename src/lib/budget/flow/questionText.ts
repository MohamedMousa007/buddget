import type { BudgetStudioCopy } from '@/lib/i18n/budgetPage/studioCopy'
import type { FlowNode, FlowState } from './types'

/** A question as the person reads it: the wording variant their answers chose, with `{income}` and `{n}` filled. */
export function questionText(ui: BudgetStudioCopy, x: FlowNode, state: FlowState, fill: (id: string) => string): string {
  const c = ui.q[x.id] ?? { label: x.id, why: '' }
  const count = Number(fill(x.id))
  const plural = count === 1 ? 'one' : count === 2 ? 'two' : ''
  return (c.variants?.[x.variant?.(state) ?? ''] ?? (x.control === 'confirm' ? c.variants?.[plural] : undefined) ?? c.label).replace('{income}', fill(x.id)).replace('{n}', fill(x.id))
}
