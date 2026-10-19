import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'

/** Enroll this device for biometric unlock. Needs an already-unlocked session, so it can never bootstrap access. */
export async function POST(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ secretHash?: string; label?: string; platform?: string }>(req)
  const secretHash = body?.secretHash?.trim()
  if (!secretHash || !/^[0-9a-f]{64}$/.test(secretHash)) return bad('Invalid secret.')

  const deviceId = await resolveDeviceId(req)
  const { error } = await ctx.service.from('admin_biometric_devices').upsert({
    device_id: deviceId,
    user_id: ctx.user.id,
    secret_hash: secretHash,
    label: body?.label?.slice(0, 60) ?? null,
    platform: body?.platform?.slice(0, 20) ?? null,
    created_at: new Date().toISOString(),
    last_used_at: null,
  })
  if (error) return bad('Could not enroll this device.', 500)
  await ctx.audit('auth.biometric_enrolled', { metadata: { platform: body?.platform } })
  return json({ ok: true })
}

export async function DELETE(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g
  const url = new URL(req.url)
  const deviceId = url.searchParams.get('deviceId') ?? (await resolveDeviceId(req))
  await ctx.service.from('admin_biometric_devices').delete().eq('device_id', deviceId).eq('user_id', ctx.user.id)
  await ctx.audit('auth.biometric_removed')
  return json({ ok: true })
}
