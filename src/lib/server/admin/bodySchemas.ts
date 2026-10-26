import { z } from 'zod'
import { readJson } from '@/lib/server/admin/guard'

/** Parses the JSON body against `schema`; null when it is missing, malformed or the wrong shape. */
export async function readValidated<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | null> {
  const parsed = schema.safeParse(await readJson(req))
  return parsed.success ? parsed.data : null
}

const text = z.string().max(20000)

export const ticketCreateBody = z.object({
  subject: text.optional(),
  message: text.optional(),
  userId: z.string().optional(),
  email: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
})

export const ticketUpdateBody = z.object({
  op: z.enum(['reply', 'update', 'board', 'delete']).optional(),
  boardState: z.string().optional(),
  boardTitle: z.string().optional(),
  boardSummary: z.string().optional(),
  message: text.optional(),
  internal: z.boolean().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  tags: z.array(z.string()).max(50).optional(),
})

export const staffBody = z.object({
  op: z.string().optional(),
  id: z.string().optional(),
  code: z.string().optional(),
  stepUpPassword: z.string().optional(),
  email: z.string().optional(),
  displayName: z.string().optional(),
  department: z.string().optional(),
  roleKey: z.string().optional(),
  extraPermissions: z.array(z.string()).max(200).optional(),
  sendEmail: z.boolean().optional(),
  role: z.object({
    key: z.string(),
    name: z.string(),
    description: z.string().optional(),
    permissions: z.array(z.string()).max(200),
    rank: z.number().optional(),
  }).optional(),
  key: z.string().optional(),
  changes: z.array(z.object({ key: z.string(), permissions: z.array(z.string()).max(200) })).max(40).optional(),
})

export const flagsBody = z.object({
  op: z.string().optional(),
  key: z.string().optional(),
  flag: z.object({
    key: z.string(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
    rolloutPct: z.number().optional(),
    planKeys: z.array(z.string()).max(50).optional(),
    platforms: z.array(z.string()).max(10).optional(),
  }).optional(),
})
