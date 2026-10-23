import { guardAdmin, json } from '@/lib/server/admin/guard'

export interface OnboardingFunnel {
  started: number
  completed: number
  left: number
  steps: Array<{ step: string; viewed: number; completed: number }>
  permissions: Array<{ kind: string; granted: boolean | null; users: number }>
}

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'analytics.view' })
  if (!g.ok) return g.res
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 30, 7), 180)
  const { data, error } = await g.ctx.service.rpc('admin_onboarding_funnel', { p_days: days })
  if (error) return json({ error: 'Could not load the onboarding funnel.' }, 500)
  return json(data as unknown as OnboardingFunnel)
}
