// Deletes synthetic users: `npx tsx e2e/journeys/lib/cleanup.ts <email...>` or `--all` for every qa-e2e-*@buddget-qa.test user.
import { deleteUser } from './admin'
import { env } from './env'

async function allQaUsers(): Promise<string[]> {
  const out: string[] = []
  for (let page = 1; page < 50; page++) {
    const r = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: env('SUPABASE_SECRET_KEY'), Authorization: `Bearer ${env('SUPABASE_SECRET_KEY')}` },
    }).then((x) => x.json())
    const users = (r.users ?? []) as { email: string }[]
    out.push(...users.map((u) => u.email).filter((e) => /^qa-e2e-.*@buddget-qa\.test$/.test(e ?? '')))
    if (users.length < 200) break
  }
  return out
}

;(async () => {
  const args = process.argv.slice(2)
  const emails = args[0] === '--all' ? await allQaUsers() : args
  for (const e of emails) { await deleteUser(e); console.log('deleted', e) }
})()
