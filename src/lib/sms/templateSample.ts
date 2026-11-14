import { maskPii } from '@/lib/sms/maskPii'

const SAMPLE_MAX_CHARS = 500

/**
 * The sample stored on a learned template, and what every screen and export shows of it. It is only there so a person
 * can recognise the format, so it is the masked form: no name, no account, phone or reference digits.
 */
export function maskTemplateSample(sample: string): string {
  return maskPii(sample).slice(0, SAMPLE_MAX_CHARS)
}

/**
 * A template row with its sample masked. Pure: the read-time mask of the admin list, and what a re-mask job writes back
 * for a row stored before samples were masked.
 */
export function remaskTemplateRow<T extends { template_sample?: string | null }>(row: T): T {
  return typeof row.template_sample === 'string' ? { ...row, template_sample: maskTemplateSample(row.template_sample) } : row
}
