/** One row of `ai_model_alerts` (migration 0342), as the overview route returns it. */
export interface AiModelAlert {
  alert_date: string
  model: string
  calls: number
  errors: number
  empties: number
  failed_share: number
  rule: string
}

/** The "Needs attention" line for a tripped chat model: newest day per model only, so a model failing all week is one line. */
export function aiModelAlertLines(alerts: AiModelAlert[]): string[] {
  const latest = new Map<string, AiModelAlert>()
  for (const a of alerts) {
    const cur = latest.get(a.model)
    if (!cur || a.alert_date > cur.alert_date) latest.set(a.model, a)
  }
  return [...latest.values()]
    .sort((a, b) => b.alert_date.localeCompare(a.alert_date) || a.model.localeCompare(b.model))
    .map((a) => {
      const failed = a.errors + a.empties
      const what = a.rule === 'all_failed' ? `all ${a.calls} chat calls failed` : `${failed} of ${a.calls} chat calls failed (${Math.round(Number(a.failed_share) * 100)}%)`
      return `Buddgy model ${a.model}: ${what} in the 24 hours before ${a.alert_date}`
    })
}
