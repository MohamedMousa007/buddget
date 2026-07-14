import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const LINEAR_GRAPHQL = 'https://api.linear.app/graphql'
const TEAM_ID = '6897293b-50cf-4cce-b332-de50b5635bb2'
const LABEL_USER_FEEDBACK = '39958100-0d5a-4e1e-8700-58781127953f'
const LABEL_BUG = '108160ab-70c9-4348-9877-b79a856d840e'
const LABEL_FEATURE = '4b4595d2-75a9-45f3-b042-e95b96f3258f'

const bodySchema = z.object({
  type: z.enum(['bug', 'feature']),
  title: z.string().min(3).max(200),
  description: z.string().max(5000).default(''),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.LINEAR_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Feedback unavailable' }, { status: 503 })

  let json: unknown
  try { json = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { type, title, description } = parsed.data
  const labelIds = [LABEL_USER_FEEDBACK, type === 'bug' ? LABEL_BUG : LABEL_FEATURE]
  const fullDescription = description
    ? `${description}\n\n---\n*Submitted by: ${user.email}*`
    : `*Submitted by: ${user.email}*`

  const res = await fetch(LINEAR_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({
      query: `mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) { success issue { id identifier url } }
      }`,
      variables: { input: { teamId: TEAM_ID, title, description: fullDescription, labelIds } },
    }),
  })

  if (!res.ok) {
    console.error('[feedback] Linear API error', res.status)
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 502 })
  }

  type LinearRes = { data?: { issueCreate?: { success: boolean; issue?: { url: string; identifier: string } } } }
  const data = await res.json() as LinearRes
  const issue = data.data?.issueCreate

  if (!issue?.success || !issue.issue) {
    console.error('[feedback] Linear GraphQL error', JSON.stringify(data))
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, issueUrl: issue.issue.url, identifier: issue.issue.identifier })
}
