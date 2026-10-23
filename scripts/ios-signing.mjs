#!/usr/bin/env node
// iOS signing housekeeping through the App Store Connect API. No dependencies.
//
// Why: the iOS workflow runs on a fresh Mac every time, so Xcode's automatic signing made a NEW Apple Development
// certificate per run until the team hit Apple's certificate cap and the archive step failed. This script (run once, from
// your Mac) frees the slots and creates ONE development certificate that the workflow imports on every run, so nothing new
// is created again.
//
//   node scripts/ios-signing.mjs list
//   node scripts/ios-signing.mjs cleanup            # revoke every certificate except the ones in this Mac's keychain
//   node scripts/ios-signing.mjs cleanup --dry-run
//   node scripts/ios-signing.mjs create-dev-cert    # create one Apple Development cert, push the CI secrets
//
// Env: ASC_KEY_PATH (AuthKey_XXXX.p8), ASC_KEY_ID, ASC_ISSUER_ID. Secrets are written with `gh secret set`, never printed.
import { createPrivateKey, sign, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID } = process.env
if (!ASC_KEY_PATH || !ASC_KEY_ID || !ASC_ISSUER_ID) {
  console.error('Set ASC_KEY_PATH, ASC_KEY_ID and ASC_ISSUER_ID.')
  process.exit(1)
}

const b64u = (b) => Buffer.from(b).toString('base64url')
function token() {
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const body = b64u(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }))
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey(readFileSync(ASC_KEY_PATH)), dsaEncoding: 'ieee-p1363' })
  return `${head}.${body}.${b64u(sig)}`
}
async function api(path, init = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, { ...init, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...init.headers } })
  if (res.status === 204) return null
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(json.errors ?? json)}`)
  return json
}
const run = (cmd, args, opts) => execFileSync(cmd, args, { encoding: 'utf8', ...opts })

async function certificates() {
  const out = []
  let next = '/v1/certificates?limit=200'
  while (next) {
    const page = await api(next.replace('https://api.appstoreconnect.apple.com', ''))
    out.push(...page.data)
    next = page.links?.next ?? null
  }
  return out
}
const line = (c) => `${c.id}  ${c.attributes.certificateType.padEnd(22)} ${String(c.attributes.name ?? c.attributes.displayName).padEnd(42)} exp ${String(c.attributes.expirationDate).slice(0, 10)}  serial ${c.attributes.serialNumber}`

/** Serial numbers of the signing identities in this Mac's keychain: those belong to you and are kept. */
function localSerials() {
  const names = [...run('security', ['find-identity', '-v', '-p', 'codesigning']).matchAll(/"([^"]+)"/g)].map((m) => m[1])
  const serials = new Set()
  for (const n of names) {
    try {
      const pem = run('security', ['find-certificate', '-c', n, '-p'])
      const s = run('openssl', ['x509', '-noout', '-serial'], { input: pem }).trim().replace('serial=', '').toUpperCase()
      serials.add(s)
    } catch { /* not exportable here */ }
  }
  return serials
}

const cmd = process.argv[2]
if (cmd === 'list') {
  for (const c of await certificates()) console.log(line(c))
} else if (cmd === 'cleanup') {
  const dry = process.argv.includes('--dry-run')
  const keep = localSerials()
  const all = await certificates()
  const doomed = all.filter((c) => !keep.has(String(c.attributes.serialNumber).toUpperCase()))
  console.log(`${all.length} certificates, keeping ${all.length - doomed.length} from this Mac's keychain, ${dry ? 'would revoke' : 'revoking'} ${doomed.length}:`)
  for (const c of doomed) {
    console.log(`  ${line(c)}`)
    if (!dry) await api(`/v1/certificates/${c.id}`, { method: 'DELETE' })
  }
} else if (cmd === 'create-dev-cert') {
  const dir = mkdtempSync(join(tmpdir(), 'ios-signing-'))
  try {
    const key = join(dir, 'key.pem'), csr = join(dir, 'req.csr'), crt = join(dir, 'cert.pem'), p12 = join(dir, 'dev.p12')
    run('openssl', ['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', csr, '-subj', '/CN=Buddget CI/O=Buddget/C=EG'])
    const res = await api('/v1/certificates', { method: 'POST', body: JSON.stringify({ data: { type: 'certificates', attributes: { certificateType: 'IOS_DEVELOPMENT', csrContent: readFileSync(csr, 'utf8') } } }) })
    writeFileSync(crt, `-----BEGIN CERTIFICATE-----\n${res.data.attributes.certificateContent.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`)
    const password = randomBytes(18).toString('base64url')
    run('openssl', ['pkcs12', '-export', '-inkey', key, '-in', crt, '-out', p12, '-passout', `pass:${password}`, '-legacy'])
    const gh = (name, value) => execFileSync('gh', ['secret', 'set', name], { input: value, stdio: ['pipe', 'ignore', 'inherit'] })
    gh('IOS_DEV_P12_B64', readFileSync(p12).toString('base64'))
    gh('IOS_DEV_P12_PASSWORD', password)
    console.log(`created ${res.data.id} (${res.data.attributes.name}); CI secrets IOS_DEV_P12_B64 and IOS_DEV_P12_PASSWORD set.`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
} else {
  console.error('usage: ios-signing.mjs list | cleanup [--dry-run] | create-dev-cert')
  process.exit(1)
}
