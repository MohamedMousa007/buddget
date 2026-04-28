import { z } from 'zod'

const paymentMethodTypeEnum = z.enum([
  'cash',
  'bank_transfer',
  'card_debit',
  'card_credit',
  'nol',
  'other',
])

export const surveyOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
})

export const paymentPresetOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  methodType: paymentMethodTypeEnum,
})

/** Single labelled control inside a `field_stack` step (all inline on one page). */
export const fieldStackFieldSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    id: z.string(),
    title: z.string(),
    placeholder: z.string().optional(),
    mapsTo: z.string().optional(),
    maxLength: z.number().optional(),
  }),
  z.object({
    kind: z.literal('country_select'),
    id: z.string(),
    title: z.string(),
    mapsTo: z.string().optional(),
    placeholder: z.string().optional(),
  }),
  z.object({
    kind: z.literal('number'),
    id: z.string(),
    title: z.string(),
    placeholder: z.string().optional(),
    mapsTo: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    kind: z.literal('single_select'),
    id: z.string(),
    title: z.string(),
    mapsTo: z.string().optional(),
    options: z.array(surveyOptionSchema),
  }),
])

export type FieldStackField = z.infer<typeof fieldStackFieldSchema>

export const surveyStepSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('static'),
    title: z.string(),
    body: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('text'),
    title: z.string(),
    placeholder: z.string().optional(),
    mapsTo: z.string(),
    maxLength: z.number().optional(),
    /** Pre-fills the input on first render. Caller supplies; the user can edit. */
    defaultValue: z.string().optional(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('country_select'),
    title: z.string(),
    mapsTo: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
    placeholder: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('number'),
    title: z.string(),
    placeholder: z.string().optional(),
    mapsTo: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('single_select'),
    title: z.string(),
    mapsTo: z.string(),
    options: z.array(surveyOptionSchema),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('multi_select'),
    title: z.string(),
    mapsTo: z.string(),
    options: z.array(surveyOptionSchema),
    minSelections: z.number().optional(),
    maxSelections: z.number().optional(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('payment_methods'),
    title: z.string(),
    mapsTo: z.string(),
    options: z.array(paymentPresetOptionSchema),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
    /** Optional closing copy (e.g. former standalone “pre plan” screen). */
    closingTitle: z.string().optional(),
    closingBody: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('income_entry'),
    title: z.string(),
    mapsTo: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('debt_entry'),
    title: z.string(),
    mapsTo: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('subscriptions_detail'),
    title: z.string(),
    mapsTo: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('goals_detail'),
    title: z.string(),
    mapsTo: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('savings_detail'),
    title: z.string(),
    mapsTo: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('field_stack'),
    title: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
    fields: z.array(fieldStackFieldSchema),
  }),
  z.object({
    id: z.string(),
    type: z.literal('goals_combined'),
    title: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
    /** Answer key for the multi-select chip list (e.g. `financial_goals`). */
    mapsTo: z.string(),
    minSelections: z.number().optional(),
    maxSelections: z.number().optional(),
    options: z.array(surveyOptionSchema),
  }),
  z.object({
    id: z.string(),
    type: z.literal('dual_live'),
    title: z.string(),
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
    subscriptionsTitle: z.string(),
    savingsTitle: z.string(),
  }),
])

export const surveyConfigRootSchema = z.object({
  steps: z.array(surveyStepSchema),
})

export type SurveyConfig = z.infer<typeof surveyConfigRootSchema>
export type SurveyStep = z.infer<typeof surveyStepSchema>

/** @returns null if JSON does not match the survey schema */
export function parseSurveyConfig(raw: unknown): SurveyConfig | null {
  const parsed = surveyConfigRootSchema.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data
}
