/** What goes to Linear: a ticket number and the facts engineers need. Never an email, a name or message content. */
export interface IssuePayload {
  number: number
  kind: string
  area: string | null
  severity: string
  subject: string
  platform: string | null
  version: string | null
}

export interface LinearConfig {
  teamId: string
  labelFeedback: string
  labelBug: string
  labelFeature: string
}

// Defaults are the workspace's own IDs (not secrets); each can be overridden by env without a deploy of code.
export const linearConfig = (env: Record<string, string | undefined> = process.env): LinearConfig => ({
  teamId: env.LINEAR_TEAM_ID ?? '6897293b-50cf-4cce-b332-de50b5635bb2',
  labelFeedback: env.LINEAR_LABEL_FEEDBACK ?? '39958100-0d5a-4e1e-8700-58781127953f',
  labelBug: env.LINEAR_LABEL_BUG ?? '108160ab-70c9-4348-9877-b79a856d840e',
  labelFeature: env.LINEAR_LABEL_FEATURE ?? '4b4595d2-75a9-45f3-b042-e95b96f3258f',
})

/** Linear priority: 1 urgent, 2 high, 3 medium, 4 low. */
const PRIORITY: Record<string, number> = { critical: 1, high: 2, normal: 3, low: 4 }

const KIND_TITLE: Record<string, string> = { bug: 'Bug report', feature: 'Feature request' }

export function buildIssue(p: IssuePayload, cfg: LinearConfig, portalUrl = 'https://admin.buddget.app') {
  const facts = [
    `Ticket #${p.number}`,
    `Severity: ${p.severity}`,
    p.area ? `Area: ${p.area}` : null,
    p.platform ? `Platform: ${p.platform}` : null,
    p.version ? `App version: ${p.version}` : null,
  ].filter(Boolean)
  return {
    teamId: cfg.teamId,
    title: `[#${p.number}] ${KIND_TITLE[p.kind] ?? 'Feedback'}${p.area ? ` (${p.area})` : ''}`.slice(0, 200),
    description: `${facts.join('\n')}\n\nFull report and conversation: ${portalUrl} (Support, ticket #${p.number}).`,
    priority: PRIORITY[p.severity] ?? 3,
    labelIds: [cfg.labelFeedback, p.kind === 'feature' ? cfg.labelFeature : cfg.labelBug],
  }
}

export type SendResult = { ok: true; id: string; identifier: string; url: string } | { ok: false; error: string }

export async function createLinearIssue(apiKey: string, input: ReturnType<typeof buildIssue>, doFetch: typeof fetch = fetch): Promise<SendResult> {
  try {
    const res = await doFetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({
        query: 'mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }',
        variables: { input },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, error: `Linear answered ${res.status}` }
    const json = (await res.json()) as { data?: { issueCreate?: { success: boolean; issue?: { id: string; identifier: string; url: string } } } }
    const issue = json.data?.issueCreate?.issue
    return json.data?.issueCreate?.success && issue ? { ok: true, ...issue } : { ok: false, error: 'Linear refused the issue' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'request failed' }
  }
}
