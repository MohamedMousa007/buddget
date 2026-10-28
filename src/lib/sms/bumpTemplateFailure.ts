import type { ServiceClient } from '@/lib/supabase/service'

interface BumpArgs {
  templateId: string
  hard: boolean
  reason: string
  userId: string | null
}

const FUNCTION_MISSING = 'PGRST202'

/**
 * Records a failure signal against a template. With a user id the v2 function can require hard signals from
 * several distinct users before quarantining a global template; before that migration is applied the function
 * does not exist (PGRST202) and the legacy 3-argument call is used instead.
 */
export async function bumpTemplateFailure(service: ServiceClient, { templateId, hard, reason, userId }: BumpArgs): Promise<void> {
  const legacy = { p_template_id: templateId, p_hard: hard, p_reason: reason }
  if (!userId) {
    await service.rpc('bump_sms_template_failure', legacy)
    return
  }
  // v2 is not in the generated types until its migration is applied and the types are regenerated.
  const rpcV2 = service.rpc as unknown as (fn: string, args: object) => PromiseLike<{ error: { code?: string } | null }>
  const { error } = await rpcV2.call(service, 'bump_sms_template_failure_v2', { ...legacy, p_user_id: userId })
  if (error?.code === FUNCTION_MISSING) await service.rpc('bump_sms_template_failure', legacy)
}
