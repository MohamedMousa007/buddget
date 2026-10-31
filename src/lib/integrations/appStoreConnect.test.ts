import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ascCredentialsFromEnv, ascToken, parseCrashLog } from './appStoreConnect'

const LOG = `Incident Identifier: 1
Version:           1.1.0 (9)
Exception Type:  EXC_CRASH (SIGABRT)
Termination Reason: SIGNAL 6 Abort trap: 6
Triggered by Thread:  0

Thread 0 Crashed:
0   libsystem_kernel.dylib        \t0x00000001a0000000 __pthread_kill + 8
1   libsystem_pthread.dylib       \t0x00000001a0000010 pthread_kill + 268
2   libsystem_c.dylib             \t0x00000001a0000020 abort + 124
3   UIKitCore                     \t0x00000001a1000000 ___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke + 700
4   libdispatch.dylib             \t0x00000001a0000030 _dispatch_client_callout + 16

Thread 1:
0   libsystem_kernel.dylib        \t0x00000001a0000000 mach_msg2_trap + 8
`

describe('parseCrashLog', () => {
  it('names the first non-runtime frame of the crashed thread and groups by it', () => {
    const c = parseCrashLog(LOG)
    expect(c.title).toBe('iOS crash: EXC_CRASH (SIGABRT) in UIKitCore: ___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke')
    expect(c.culprit).toContain('UIKitCore')
    expect(c.stack).toContain('UIKitCore')
    expect(parseCrashLog(LOG.replace('+ 700', '+ 12')).fingerprint).toBe(c.fingerprint)
    expect(c.fingerprint).toMatch(/^asc:[0-9a-f]{16}$/)
  })
  it('falls back on unparseable logs', () => {
    expect(parseCrashLog('garbage').title).toBe('iOS crash: Unknown exception')
  })
})

describe('App Store Connect credentials', () => {
  it('needs all four variables and unescapes the key', () => {
    expect(ascCredentialsFromEnv({ ASC_ISSUER_ID: 'i', ASC_KEY_ID: 'k' })).toBeNull()
    expect(ascCredentialsFromEnv({ ASC_ISSUER_ID: 'i', ASC_KEY_ID: 'k', ASC_PRIVATE_KEY: 'a\\nb', ASC_APP_ID: '1' })?.privateKey).toBe('a\nb')
  })
  it('signs a three-part ES256 token', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const token = ascToken({ issuerId: 'i', keyId: 'k', privateKey: pem, appId: '1' }, 0)
    const [head, body, sig] = token.split('.')
    expect(JSON.parse(Buffer.from(head, 'base64url').toString())).toMatchObject({ alg: 'ES256', kid: 'k' })
    expect(JSON.parse(Buffer.from(body, 'base64url').toString())).toMatchObject({ iss: 'i', aud: 'appstoreconnect-v1', exp: 900 })
    expect(Buffer.from(sig, 'base64url')).toHaveLength(64)
  })
})
