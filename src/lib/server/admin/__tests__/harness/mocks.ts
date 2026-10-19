/** vi.mock factories shared by the Postgres-backed admin tests. */
import { adminPool, createPgServiceClient, loadAuthUser } from './pgSupabase'

export const serviceMock = () => ({
  createServiceRoleClient: () => createPgServiceClient(),
  createSecretClient: () => createPgServiceClient(),
})

/** The signed-in Buddget account is named by the `x-test-user` header, standing in for the Supabase cookie / Bearer. */
export const routeUserMock = () => ({
  resolveRouteUser: async (req: Request) => {
    const id = req.headers.get('x-test-user')
    return { user: id ? await loadAuthUser(id) : null }
  },
})

export const deviceMock = () => ({
  resolveDeviceId: async (req: Request) => req.headers.get('x-buddget-device-id') ?? 'web-device',
})

type OtpGlobals = { __otp?: Map<string, string>; __otpSent?: string[]; __otpSendError?: { status: number } | null }
const g = globalThis as OtpGlobals
const otpStore = () => (g.__otp ??= new Map())

/** The code GoTrue would have emailed to `email`. Stands in for the mail send. */
export function issueCode(email: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  otpStore().set(email, code)
  return code
}
export const sentCodes = () => (g.__otpSent ??= [])
export const failNextSends = (status: number | null) => { g.__otpSendError = status ? { status } : null }
export const resetOtp = () => { otpStore().clear(); g.__otpSent = []; g.__otpSendError = null }

/** Stands in for GoTrue's email OTP (send and verify) through the non-persisting anon client. */
export const supabaseJsMock = () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: async ({ email, options }: { email: string; options?: { shouldCreateUser?: boolean } }) => {
        if (g.__otpSendError) return { data: {}, error: { message: 'send failed', status: g.__otpSendError.status } }
        if (options?.shouldCreateUser !== false) return { data: {}, error: { message: 'must not create users', status: 400 } }
        issueCode(email)
        sentCodes().push(email)
        return { data: {}, error: null }
      },
      resetPasswordForEmail: async (email: string) => {
        ;(globalThis as { __resetEmails?: string[] }).__resetEmails ??= []
        ;(globalThis as { __resetEmails?: string[] }).__resetEmails!.push(email)
        return { data: {}, error: null }
      },
      verifyOtp: async ({ email, token, type }: { email: string; token: string; type: string }) => {
        const stored = otpStore().get(email)
        if (type !== 'email' || !stored || stored !== token) return { data: { user: null }, error: { message: 'Token has expired or is invalid' } }
        otpStore().delete(email)
        const r = await adminPool().query(`select id from auth.users where email = $1`, [email])
        return { data: { user: r.rows[0] ? { id: r.rows[0].id } : null }, error: null }
      },
    },
  }),
})
