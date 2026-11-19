// Creates the synthetic QA user, two devices, one ingest token per device (minted like /api/sms/setup-token:
// randomUUID, only sha256(lower) stored) and accounts with known last-4s. Tokens are kept only in out/state.json.
import { createHash, randomUUID } from 'node:crypto'
import { admin, writeState } from './lib.mjs'

const db = admin()
const email = 'qa-sms-1@buddget-qa.test'
const { data: created, error } = await db.auth.admin.createUser({ email, password: randomUUID() + 'Aa1!', email_confirm: true })
if (error) throw error
const userId = created.user.id

const devices = [
  { device_id: 'qa-sms-android-1', platform: 'android', model: 'QA Pixel', name: 'QA Android' },
  { device_id: 'qa-sms-iphone-1', platform: 'ios', model: 'QA iPhone', name: 'QA iPhone' },
]
for (const d of devices) {
  const { error: e } = await db.from('user_devices').insert({ user_id: userId, ...d, collects_sms: true })
  if (e) throw e
}
const tokens = {}
for (const d of devices) {
  const token = randomUUID()
  const token_hash = createHash('sha256').update(token.trim().toLowerCase()).digest('hex')
  const { error: e } = await db.from('sms_ingest_tokens').insert({ user_id: userId, device_id: d.device_id, token_hash, is_active: true })
  if (e) throw e
  tokens[d.device_id] = token
}

const accounts = [
  { name: 'QA CIB Credit', type: 'credit_card', currency: 'EGP', last4: '4821' },
  { name: 'QA CIB Current', type: 'bank_account', currency: 'EGP', last4: '7310' },
  { name: 'QA CIB Savings', type: 'bank_account', currency: 'EGP', last4: '1188' },
  { name: 'QA NBE Current', type: 'bank_account', currency: 'EGP', last4: '5512' },
  { name: 'QA HSBC Current', type: 'bank_account', currency: 'EGP', last4: '3307' },
  { name: 'QA QNB Debit', type: 'debit_card', currency: 'EGP', last4: '9044' },
  { name: 'QA Cash', type: 'cash', currency: 'EGP', last4: null },
]
const ids = {}
for (const a of accounts) {
  const { data, error: e } = await db.from('payment_methods').insert({ user_id: userId, ...a, track_sms: a.type !== 'cash', opening_balance: 50000 }).select('id').single()
  if (e) throw e
  ids[a.last4 ?? 'cash'] = data.id
}
writeState({ userId, email, tokens, accounts: ids })
console.log('created user', userId, 'devices', devices.length, 'accounts', accounts.length)
