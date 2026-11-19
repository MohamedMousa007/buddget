// Shared helpers for the QA SMS end-to-end driver. Reads .env.local without printing any value.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

export function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.resolve('.env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return env
}

export function admin() {
  const env = loadEnv()
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
}

export const STATE = process.env.QA_SMS_STATE ?? path.resolve('e2e/sms/out/state.json')
export const readState = () => JSON.parse(fs.readFileSync(STATE, 'utf8'))
export const writeState = (s) => { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)) }
