/**
 * Drains pending user signals into verdicts — the step that closes the correction loop.
 *
 * Runs opportunistically in the parse route's `after()` rather than on a cron: any SMS arriving
 * for any user is a fine moment to spend a little background work, and it needs no new
 * infrastructure. The RPC it starts from is cheap and usually returns nothing.
 *
 * Cost note (D1): this never writes an `sms_parse_log` row, and the per-user AI quota is derived
 * from that table — so the system's own quality checks can never exhaust a user's 100/day
 * parsing budget. That property is load-bearing; do not make this function log a parse.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ADJUDICATOR_PROMPT,
  buildAdjudicationPrompt,
  parseAdjudication,
  redactBody,
  verdictCountsAgainstTemplate,
  type AdjudicationInput,
} from '@/lib/sms/adjudicator'
import { bodyShapeKey } from '@/lib/sms/routingKey'

/** Templates adjudicated per invocation — this is background work riding on a user request. */
const MAX_TEMPLATES_PER_RUN = 2

interface SignalRow {
  id: string
  template_id: string
  sms_log_id: string | null
  signal_kind: 'objective_edit' | 'delete' | 'reported'
  field: string | null
  old_value: string | null
  new_value: string | null
}

export interface AdjudicationDeps {
  /** Calls the model with a system prompt + user content, returning parsed JSON or null. */
  askModel: (system: string, user: string) => Promise<unknown | null>
}

/**
 * Adjudicates every template that has reached the signal threshold.
 * Returns a short summary for logging; never throws — quality bookkeeping must not break the
 * request it is riding on.
 */
export async function runAdjudication(
  service: SupabaseClient,
  deps: AdjudicationDeps,
): Promise<{ adjudicated: number; counted: number }> {
  let adjudicated = 0
  let counted = 0

  try {
    const { data: due } = await service.rpc('sms_templates_awaiting_adjudication', {
      p_undo_grace_seconds: 120,
    })
    const templates = ((due ?? []) as Array<{ template_id: string }>).slice(0, MAX_TEMPLATES_PER_RUN)
    if (templates.length === 0) return { adjudicated, counted }

    for (const { template_id } of templates) {
      const { data: signalRows } = await service
        .from('sms_template_signals')
        .select('id, template_id, sms_log_id, signal_kind, field, old_value, new_value')
        .eq('template_id', template_id)
        .is('verdict', null)
        .order('created_at', { ascending: true })
        .limit(10)

      const signals = (signalRows ?? []) as SignalRow[]
      if (signals.length === 0) continue

      // Adjudicate against ONE message — the signals are all complaints about the same template,
      // and the first with a body is enough to judge whether the extraction matches the SMS.
      const logId = signals.find((s) => s.sms_log_id)?.sms_log_id
      if (!logId) {
        await markVerdict(service, signals, 'unclear')
        continue
      }

      const { data: log } = await service
        .from('sms_parse_log')
        .select('raw_body, amount, currency, kind, account_last4, received_at')
        .eq('id', logId)
        .maybeSingle()
      if (!log?.raw_body) {
        await markVerdict(service, signals, 'unclear')
        continue
      }

      const input: AdjudicationInput = {
        body: log.raw_body as string,
        extracted: {
          amount: (log.amount as number | null) ?? null,
          currency: (log.currency as string | null) ?? null,
          kind: (log.kind as string | null) ?? null,
          last4: (log.account_last4 as string | null) ?? null,
          date: ((log.received_at as string | null) ?? '').slice(0, 10) || null,
        },
        changes: signals.map((s) => ({
          signalKind: s.signal_kind,
          field: s.field,
          from: s.old_value,
          to: s.new_value,
        })),
      }

      const raw = await deps.askModel(ADJUDICATOR_PROMPT, buildAdjudicationPrompt(input))
      if (raw === null) continue // model unavailable — leave the signals pending for next time

      const result = parseAdjudication(raw)
      await markVerdict(service, signals, result.verdict)
      adjudicated += signals.length

      if (verdictCountsAgainstTemplate(result.verdict)) {
        counted++
        await service.rpc('bump_sms_template_failure', {
          p_template_id: template_id,
          // A user-reported defect is real but singular; let it accumulate as a rate rather than
          // retire a template on one person's say-so.
          p_hard: false,
          p_reason: `adjudicated_${result.verdict}: ${result.reason ?? ''}`.slice(0, 200),
        })

        // The correction is the system's memory: injected into future prompts for this message
        // shape so the same mistake is not repeated for the next user.
        if (result.verdict === 'parse_error' && result.corrected) {
          const shape = bodyShapeKey(input.body)
          if (shape) {
            await service.from('sms_corrections').insert({
              body_shape_key: shape,
              redacted_body: redactBody(input.body),
              corrected_fields: result.corrected,
              source_template_id: template_id,
              source_signal_id: signals[0].id,
              confidence: result.confidence,
            })
          }
        }
      }
    }
  } catch (e) {
    console.warn('[sms/adjudication] run failed', e)
  }

  return { adjudicated, counted }
}

async function markVerdict(
  service: SupabaseClient,
  signals: SignalRow[],
  verdict: string,
): Promise<void> {
  await service
    .from('sms_template_signals')
    .update({ verdict, adjudicated_at: new Date().toISOString() })
    .in(
      'id',
      signals.map((s) => s.id),
    )
}
