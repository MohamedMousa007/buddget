import { test } from '@playwright/test'
import { deleteUser } from '../../journeys/lib/admin'
import { hasUsers, readUsers } from '../lib'

test('delete every synthetic user created by this run', async () => {
  if (!hasUsers()) return
  const u = readUsers() as unknown as Record<string, { email?: string }>
  for (const k of ['small', 'large']) if (u[k]?.email) await deleteUser(u[k].email)
})
