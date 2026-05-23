export type FeatureDependency =
  | 'income'
  | 'budget_plan'
  | 'payment_method'
  | 'debt'
  | 'savings'
  | 'goal'

export interface DependencyStatus {
  income: boolean
  budget_plan: boolean
  payment_method: boolean
  debt: boolean
  savings: boolean
  goal: boolean
}
