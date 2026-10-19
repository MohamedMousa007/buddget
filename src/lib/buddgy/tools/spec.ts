/** A tool as the model sees it. Executors live on the device (see `exec/`). */

export type ToolKind = 'read' | 'write' | 'nav'

/** How much friction a write gets: `auto` may apply with an Undo toast, `strong` names the entity and uses destructive styling. */
export type ToolRisk = 'auto' | 'approve' | 'strong'

export type ToolDomain =
  | 'expenses'
  | 'income'
  | 'debts'
  | 'subscriptions'
  | 'goals'
  | 'savings'
  | 'budget'
  | 'payments'
  | 'settings'
  | 'profile'
  | 'memory'
  | 'navigation'
  | 'reports'

export interface JsonSchema {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: string[]
}

export interface ToolSpec {
  name: string
  domain: ToolDomain
  kind: ToolKind
  risk?: ToolRisk
  /** One short line. Every word is paid for on every turn. */
  description: string
  params: JsonSchema
}

export const obj = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
})

export const str = (description?: string): JsonSchema => ({ type: 'string', ...(description ? { description } : {}) })
export const num = (description?: string): JsonSchema => ({ type: 'number', ...(description ? { description } : {}) })
export const int = (description?: string): JsonSchema => ({ type: 'integer', ...(description ? { description } : {}) })
export const bool = (description?: string): JsonSchema => ({ type: 'boolean', ...(description ? { description } : {}) })
export const oneOf = (values: string[], description?: string): JsonSchema => ({
  type: 'string',
  enum: values,
  ...(description ? { description } : {}),
})
export const arr = (items: JsonSchema, description?: string): JsonSchema => ({
  type: 'array',
  items,
  ...(description ? { description } : {}),
})

export function toGeminiDeclaration(spec: ToolSpec): Record<string, unknown> {
  const hasParams = Object.keys(spec.params.properties ?? {}).length > 0
  return { name: spec.name, description: spec.description, ...(hasParams ? { parameters: spec.params } : {}) }
}
