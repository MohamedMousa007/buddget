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

export const ACCOUNT_PASSWORD = 'account-password-1'

/** Stands in for GoTrue's password grant (account re-authentication during setup) and recovery email. */
export const supabaseJsMock = () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const r = await adminPool().query(`select id from auth.users where email = $1`, [email])
        if (password === ACCOUNT_PASSWORD && r.rows[0]) return { data: { user: { id: r.rows[0].id } }, error: null }
        return { data: { user: null }, error: { message: 'Invalid login credentials' } }
      },
      resetPasswordForEmail: async (email: string) => {
        ;(globalThis as { __resetEmails?: string[] }).__resetEmails ??= []
        ;(globalThis as { __resetEmails?: string[] }).__resetEmails!.push(email)
        return { data: {}, error: null }
      },
    },
  }),
})
