#!/usr/bin/env node
/**
 * Patches the third-party Capacitor Android plugin that needs a fix for our flows.
 * Re-run after every `npm install` — wired into postinstall and `cap:build`.
 * Fails loudly when the plugin is installed but the patch anchor is gone (a plugin upgrade changed the code):
 * a silently dropped patch would ship a regression.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const APPLE_PROVIDER_JAVA =
  'node_modules/@capgo/capacitor-social-login/android/src/main/java/ee/forgr/capacitor/social/login/AppleProvider.java'

const ANCHOR = 'dialog.setCancelable(true);'
const INJECTION = `${ANCHOR}
        dialog.setOnCancelListener(d -> {
            if (AppleProvider.this.lastcall != null) {
                AppleProvider.this.lastcall.reject("USER_CANCELLED");
                AppleProvider.this.lastcall = null;
            }
        });`

/**
 * capgo Apple-on-Android (broadcast-channel Dialog) never rejects its PluginCall
 * when the user dismisses the dialog (back-press), so the JS promise hangs and a
 * retry collides with the still-registered call. Inject a cancel listener that
 * rejects `lastcall` so our JS treats it as a clean USER_CANCELLED cancel.
 * @returns {{ status: 'patched' | 'already-patched' | 'anchor-missing', content: string }}
 */
export function applyAppleProviderCancel(content) {
  if (content.includes('setOnCancelListener')) return { status: 'already-patched', content }
  if (!content.includes(ANCHOR)) return { status: 'anchor-missing', content }
  return { status: 'patched', content: content.replace(ANCHOR, INJECTION) }
}

function main() {
  const file = resolve(ROOT, APPLE_PROVIDER_JAVA)
  if (!existsSync(file)) {
    console.log('[patch-android] skip AppleProvider.java — not installed')
    return
  }
  const { status, content } = applyAppleProviderCancel(readFileSync(file, 'utf8'))
  if (status === 'anchor-missing') {
    console.error('[patch-android] AppleProvider.java — anchor not found: @capgo/capacitor-social-login changed. Re-check the cancel fix and update this script.')
    process.exit(1)
  }
  if (status === 'patched') writeFileSync(file, content)
  console.log(`[patch-android] AppleProvider.java — ${status}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
