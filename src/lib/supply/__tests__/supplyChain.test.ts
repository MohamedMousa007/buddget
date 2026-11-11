// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { blockingVulnerabilities } from '../../../../scripts/audit-gate-lib.mjs'
import { applyAppleProviderCancel } from '../../../../scripts/patch-android-plugins.mjs'

const ROOT = path.resolve(__dirname, '../../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const require = createRequire(import.meta.url)

const adv = (id: string, name: string) => ({ source: 1, name, title: 't', url: `https://github.com/advisories/${id}`, severity: 'high' })
const report = (extraAdvisories: ReturnType<typeof adv>[] = []) => ({
  vulnerabilities: {
    'serialize-javascript': { severity: 'high', via: [adv('GHSA-5c6j-r48x-rmvq', 'serialize-javascript'), ...extraAdvisories] },
    'rollup-plugin-terser': { severity: 'high', via: ['serialize-javascript'] },
    'workbox-build': { severity: 'high', via: ['rollup-plugin-terser', '@rollup/plugin-node-resolve'] },
    '@rollup/plugin-node-resolve': { severity: 'low', via: ['deepmerge'] },
    deepmerge: { severity: 'low', via: [adv('GHSA-gcqx-w48m-w2h4', 'deepmerge')] },
  },
})
const ALLOW = { 'GHSA-5c6j-r48x-rmvq': '2027-03-31', 'GHSA-gcqx-w48m-w2h4': '2027-03-31' }
const names = (r: ReturnType<typeof report>, allow: Record<string, string>, now: Date) => blockingVulnerabilities(r, allow, now).map(([n]) => n)

describe('SUP-10 audit gate allowlists by advisory id with an expiry', () => {
  const now = new Date('2026-11-06T00:00:00Z')
  it('passes a transitive chain whose every root advisory is allowlisted', () => {
    expect(names(report(), ALLOW, now)).toEqual([])
  })
  it('blocks when a NEW advisory appears on an already-allowed package', () => {
    expect(names(report([adv('GHSA-new0-0000-0000', 'serialize-javascript')]), ALLOW, now)).toEqual(['serialize-javascript', 'rollup-plugin-terser', 'workbox-build'])
  })
  it('blocks once the allowlist entry has expired', () => {
    expect(names(report(), ALLOW, new Date('2027-04-01T00:00:00Z'))).toContain('workbox-build')
  })
  it('blocks a via that points at a package missing from the report', () => {
    const r = { vulnerabilities: { x: { severity: 'critical', via: ['ghost'] } } }
    expect(blockingVulnerabilities(r, ALLOW, now).map(([n]) => n)).toEqual(['x'])
  })
  it('the real gate runs against the live lockfile and passes', () => {
    const r = spawnSync('node', ['scripts/audit-gate.mjs'], { cwd: ROOT, encoding: 'utf8' })
    expect(r.stderr).not.toMatch(/HIGH|CRITICAL/)
  }, 60_000)
})

describe('SUP-17 plugin patch script fails loudly', () => {
  it('patches, recognises an applied patch, and reports a missing anchor', () => {
    const src = 'class A {\n  void f() { dialog.setCancelable(true); }\n}'
    const patched = applyAppleProviderCancel(src)
    expect(patched.status).toBe('patched')
    expect(patched.content).toContain('setOnCancelListener')
    expect(applyAppleProviderCancel(patched.content).status).toBe('already-patched')
    expect(applyAppleProviderCancel('class B {}').status).toBe('anchor-missing')
  })
  it('no longer carries the dead capacitor-sms-retriever entries and exits 1 on a missing anchor', () => {
    const s = read('scripts/patch-android-plugins.mjs')
    expect(s).not.toContain('sms-retriever')
    expect(s).toMatch(/anchor-missing[\s\S]*process\.exit\(1\)/)
  })
})

describe('SUP-12 / SST-6 WebView debugging is opt-in', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })
  const load = async () => (await import('../../../../capacitor.config')).default.android?.webContentsDebuggingEnabled
  it.each(['development', 'test', ''])('is off when NODE_ENV=%j and no flag', async (env) => {
    vi.stubEnv('NODE_ENV', env)
    vi.stubEnv('CAP_WEBVIEW_DEBUG', '')
    expect(await load()).toBe(false)
  })
  it('turns on only with CAP_WEBVIEW_DEBUG=1', async () => {
    vi.stubEnv('CAP_WEBVIEW_DEBUG', '1')
    expect(await load()).toBe(true)
  })
})

describe('SUP-7 / SUP-8 workflows', () => {
  const workflows = ['ci', 'ios-release', 'android-release'].map((n) => [n, read(`.github/workflows/${n}.yml`)] as const)
  it('ci.yml declares read-only token permissions at the top level', () => {
    expect(read('.github/workflows/ci.yml')).toMatch(/^permissions:\n {2}contents: read$/m)
  })
  it.each(workflows)('%s pins every third-party action to a commit SHA', (_n, text) => {
    const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1])
    expect(uses.length).toBeGreaterThan(0)
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/)
  })
})

describe('SUP-14 / SUP-15 / SUP-13 repo and native config', () => {
  it('the Cursor deployment rule agrees with CLAUDE.md (auto-merge to main)', () => {
    const rule = read('.cursor/rules/deployment-protocol.mdc')
    expect(rule).not.toMatch(/never push to `?main`?|never push to \*\*`?main/i)
    expect(rule).toContain('HEAD:main')
  })
  it('the unused app.buddget:// custom scheme is not registered on either platform', () => {
    expect(read('android/app/src/main/AndroidManifest.xml')).not.toContain('android:scheme="app.buddget"')
    expect(read('ios/App/App/Info.plist')).not.toMatch(/<string>app\.buddget<\/string>/)
    expect(read('ios/App/App/Info.plist')).toContain('com.googleusercontent.apps')
  })
  it('iOS native Sentry scrubs free text before sending', () => {
    const swift = read('ios/App/App/AppDelegate.swift')
    expect(swift).toContain('options.beforeSend')
    expect(swift).toContain('options.beforeBreadcrumb')
  })
  it('Android native code never builds an exception or report message from a template string', () => {
    const dir = path.join(ROOT, 'android/app/src/main/java')
    const files: string[] = []
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : f.endsWith('.kt') && files.push(path.join(d, f))))
    walk(dir)
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      expect(text, f).not.toMatch(/(throw\s+\w*Exception|Exception|IllegalStateException|IllegalArgumentException)\(\s*"[^"]*\$/)
      expect(text, f).not.toMatch(/Sentry\.capture/)
    }
  })
})

describe('SUP-5 / SUP-6 / shell hardening', () => {
  it('native-release.sh removes its work dir on success and keeps only logs on failure', () => {
    const s = read('scripts/native-release.sh')
    expect(s).toContain('trap cleanup EXIT')
    expect(s).toContain('rm -rf "$WORK"')
    expect(s).toContain("! -name '*.log'")
    expect(s).toContain('DEVELOPMENT_TEAM="$TEAM"')
  })
  it('every tracked script uses strict mode', () => {
    for (const f of ['native-release', 'upload-apk', 'ci-secrets', 'verify', 'download-subscription-icons', 'qa/setup']) {
      expect(read(`scripts/${f}.sh`), f).toMatch(/^set -euo pipefail$/m)
    }
  })

  describe('upload-apk.sh', () => {
    const setup = () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'upl-'))
      const bin = path.join(dir, 'bin')
      require('node:fs').mkdirSync(bin)
      const log = path.join(dir, 'rclone.log')
      writeFileSync(
        path.join(bin, 'rclone'),
        `#!/bin/bash\necho "$@" >> "${log}"\ncase "$1" in lsjson) echo '{"ID":"FILEID_123","Name":"x"}';; link) echo "https://drive.google.com/open?id=PUBLIC";; esac\n`,
      )
      chmodSync(path.join(bin, 'rclone'), 0o755)
      const apk = path.join(dir, 'buddget-android-vc1-test.apk')
      writeFileSync(apk, 'x')
      const run = (args: string[], env: Record<string, string> = {}) =>
        spawnSync('bash', ['scripts/upload-apk.sh', ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ...env } })
      return { run, apk, log, dir }
    }
    it('returns a private Drive file link by default and never creates a public share', () => {
      const { run, apk, log } = setup()
      const r = run([apk])
      expect(r.status).toBe(0)
      expect(r.stdout.trim()).toBe('https://drive.google.com/file/d/FILEID_123/view')
      expect(readFileSync(log, 'utf8')).not.toMatch(/^link /m)
    })
    it('creates the anyone-with-link share only with APK_PUBLIC_LINK=1', () => {
      const { run, apk, log } = setup()
      const r = run([apk], { APK_PUBLIC_LINK: '1' })
      expect(r.status).toBe(0)
      expect(r.stdout.trim()).toContain('PUBLIC')
      expect(readFileSync(log, 'utf8')).toMatch(/^link .*--drive-link-type=view/m)
    })
    it('rejects a missing file and an unexpected file name before touching Drive', () => {
      const { run, dir, log } = setup()
      expect(run([path.join(dir, 'missing.apk')]).status).toBe(1)
      const odd = path.join(dir, 'a b;c.apk')
      writeFileSync(odd, 'x')
      expect(run([odd]).status).toBe(1)
      expect(existsSync(log)).toBe(false)
    })
  })

  describe('ci-secrets.sh validates its arguments before reading any credential', () => {
    const run = (args: string[]) => spawnSync('bash', ['scripts/ci-secrets.sh', ...args], { cwd: ROOT, encoding: 'utf8' })
    const dir = mkdtempSync(path.join(tmpdir(), 'cis-'))
    const p8 = path.join(dir, 'AuthKey.p8')
    writeFileSync(p8, 'k')
    it('rejects a bad key id, a bad issuer and a missing key file', () => {
      expect(run([p8, 'bad key', '12345678-1234-1234-1234-123456789012']).stderr).toContain('ASC_KEY_ID')
      expect(run([p8, 'ABCDE12345', 'nope']).stderr).toContain('ASC_ISSUER_ID')
      expect(run([path.join(dir, 'none.p8'), 'ABCDE12345', '12345678-1234-1234-1234-123456789012']).stderr).toContain('Not a file')
    })
  })
})
