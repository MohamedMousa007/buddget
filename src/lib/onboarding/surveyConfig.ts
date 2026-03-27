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
    subtitle: z.string().optional(),
    helpText: z.string().optional(),
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
