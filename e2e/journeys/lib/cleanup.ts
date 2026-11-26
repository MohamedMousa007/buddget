// Deletes synthetic users: `npx tsx e2e/journeys/lib/cleanup.ts <email...>`, `--mine` for the users this checkout made (its
// ledger, see qaEmail), `--check-mine` to count those still on the server, or `--all` for EVERY qa-e2e-*@buddget-qa.test user,
// including other sessions' running users: use `--all` only when no other session is testing.
import { existsSync, readFileSync } from 'node:fs'
import { USER_LEDGER, deleteUser } from './admin'
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
  if (args[0] === '--mine' || args[0] === '--check-mine') {
    const mine = new Set(existsSync(USER_LEDGER) ? readFileSync(USER_LEDGER, 'utf8').split(/\r?\n/).filter(Boolean) : [])
    const left = (await allQaUsers()).filter((e) => mine.has(e))
    console.log(`ledger ${mine.size}, still on the server ${left.length}`)
    if (args[0] === '--mine') for (const e of left) await deleteUser(e)
    if (args[0] === '--mine') console.log(`deleted ${left.length}`)
    return
  }
  const emails = args[0] === '--all' ? await allQaUsers() : args
  for (const e of emails) { await deleteUser(e); console.log('deleted', e) }
})()
