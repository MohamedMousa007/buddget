export type BudgetHeroKind = 'left' | 'over'

/** Past the budget the hero shows the overage, not a negative "left". */
export function budgetHero(budget: number, spent: number): { kind: BudgetHeroKind; amount: number } {
  return spent > budget ? { kind: 'over', amount: spent - budget } : { kind: 'left', amount: budget - spent }
}
