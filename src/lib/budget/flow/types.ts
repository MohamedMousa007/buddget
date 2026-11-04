export type FlowIntent = 'save' | 'goal' | 'debt' | 'mixed'
export type FlowModule = 'found' | 'income' | 'housing' | 'household' | 'life' | 'debts' | 'security' | 'goals' | 'annual' | 'priorities'
export type FlowControl = 'confirm' | 'chips' | 'multi' | 'amount' | 'stepper' | 'toggle' | 'slider'
export type FlowValue = string | number | boolean | string[]

/**
 * Everything the flow knows. `a` holds the user's answers, `known` what the app already holds (income, debts, goals...),
 * `skipped` the questions answered "not sure" (the plan uses a typical value and marks the line as estimated).
 */
export interface FlowState {
  intent: FlowIntent
  a: Record<string, FlowValue>
  known: Record<string, FlowValue>
  skipped: string[]
  /** The always-asked "about you" step has been answered. */
  opener?: 'done'
  /** Records created from the answers, so a retried build never creates them twice. */
  entities?: Record<string, string>
  /** Index of the furthest module reached. Questions in earlier modules are never asked again. */
  cursor: number
}

export interface FlowNode {
  id: string
  mod: FlowModule
  control: FlowControl
  opts?: readonly string[]
  min?: number
  max?: number
  /** Question as the user reads it. */
  q: string
  /** One line on why it is asked. */
  why: string
  /** Asked only while this holds; reads answers that were collected earlier in the flow. */
  when?: (s: FlowState) => boolean
  /** How much of the plan this answer can move (0 to 1). Ranks the standard questions when the budget is short. */
  stake: number
  /** core: always asked when needed. std: competes for the short per-run budget. follow: unlocked by a parent answer, never cut. */
  tier: 'core' | 'std' | 'follow'
  /** Offers "Not sure": the plan then uses a typical value and marks the line as estimated. */
  skippable?: boolean
  /** Fires at a module boundary once every module in `needs` is finished, when `when` holds. Used for checks that need the whole picture. */
  needs?: readonly FlowModule[]
  /** Fields that share a screen. The user sees one card with up to a few related fields, so a run is counted in screens. */
  group?: string
  /** A wording variant chosen from earlier answers, so nobody is asked what they already told us. Undefined means the plain question. */
  variant?: (s: FlowState) => string | undefined
}
