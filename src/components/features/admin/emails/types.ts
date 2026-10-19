import type { EmailBlock } from '@/lib/email/blocks'
import type { EmailLocale, EmailScenario } from '@/lib/email/scenarios'

export interface TemplateRow {
  subject: string
  preheader: string
  html: string
  mode: 'visual' | 'html'
  blocks: EmailBlock[]
  version: number
  status: 'draft' | 'published'
  updated_at: string
}

export interface ScenarioSummary extends EmailScenario {
  locales: Record<EmailLocale, { state: 'draft' | 'published' | 'none'; version: number; updatedAt: string | null }>
}

export interface TemplateDetail {
  scenario: EmailScenario
  locales: Record<EmailLocale, { published: TemplateRow | null; draft: TemplateRow | null }>
  versions: Array<{ locale: EmailLocale; version: number; published_at: string }>
  blank: Record<EmailLocale, { subject: string; preheader: string; blocks: EmailBlock[] }>
  samples: Record<string, string>
}

/** One language's editor state. */
export interface Working {
  subject: string
  preheader: string
  mode: 'visual' | 'html'
  html: string
  blocks: EmailBlock[]
  /** Where it came from: a saved draft, the published copy, or a blank start. */
  origin: 'draft' | 'published' | 'new'
  version: number
  /** Snapshot of the content as last loaded or saved, to tell what changed. */
  base: string
}
