interface UsageDb {
  from: (view: string) => {
    select: (cols: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: Record<string, number> | null; error: unknown }> } }
  }
}

/** AI-tier calls today (parsed + AI rejects). Falls back to the parsed-only view until migration 0211 is applied. */
export async function aiCallsToday(db: UsageDb, userId: string): Promise<number> {
  const ai = await db.from('sms_ai_today').select('ai_count_today').eq('user_id', userId).maybeSingle()
  if (!ai.error) return ai.data?.ai_count_today ?? 0
  const legacy = await db.from('sms_parse_today').select('parsed_count_today').eq('user_id', userId).maybeSingle()
  return legacy.data?.parsed_count_today ?? 0
}
