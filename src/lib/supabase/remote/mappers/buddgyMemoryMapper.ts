import type { BuddgyMemory } from '@/lib/store/types'
import type { Database } from '@/lib/supabase/database.types'

type MemoryRow = Database['public']['Tables']['buddgy_memories']['Row']
type MemoryInsert = Database['public']['Tables']['buddgy_memories']['Insert']

export function memoryToRow(m: BuddgyMemory, userId: string): MemoryInsert {
  return { id: m.id, user_id: userId, text: m.text, kind: m.kind, source: m.source, status: m.status, plan_id: m.planId ?? null, created_at: m.createdAt, edited_at: m.updatedAt }
}

export function memoryFromRow(row: MemoryRow): BuddgyMemory {
  return {
    id: row.id,
    text: row.text,
    kind: row.kind as BuddgyMemory['kind'],
    source: row.source as BuddgyMemory['source'],
    status: row.status as BuddgyMemory['status'],
    ...(row.plan_id ? { planId: row.plan_id } : {}),
    createdAt: row.created_at,
    updatedAt: row.edited_at,
  }
}
