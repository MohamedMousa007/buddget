#!/usr/bin/env node
/**
 * Patches the third-party Capacitor plugin (@capgo/capacitor-social-login) for our flows, Android and iOS.
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

const SOCIAL_LOGIN_PACKAGE_SWIFT = 'node_modules/@capgo/capacitor-social-login/Package.swift'
const FACEBOOK_LINE = /^.*(facebook-ios-sdk|FBSDKCoreKit and FBSDKLoginKit).*\n/gm

/**
 * No Facebook sign-in. The plugin's cap sync hook only edits its podspec, but the iOS app uses SPM,
 * so Package.swift would still link the Facebook SDK (and its tracking privacy manifest).
 * The plugin's Swift code is behind `#if canImport(FBSDKLoginKit)`, so dropping the package is enough.
 * @returns {{ status: 'patched' | 'already-patched' | 'anchor-missing', content: string }}
 */
export function applyNoFacebookPackage(content) {
  if (!content.includes('facebook-ios-sdk')) return { status: 'already-patched', content }
  const next = content.replace(FACEBOOK_LINE, '')
  if (next.includes('facebook-ios-sdk') || !content.includes('.product(name: "FacebookLogin"')) return { status: 'anchor-missing', content }
  return { status: 'patched', content: next }
}

function patchFile(path, apply, label) {
  const file = resolve(ROOT, path)
  if (!existsSync(file)) {
    console.log(`[patch-plugins] skip ${label} — not installed`)
    return
  }
  const { status, content } = apply(readFileSync(file, 'utf8'))
  if (status === 'anchor-missing') {
    console.error(`[patch-plugins] ${label} — anchor not found: @capgo/capacitor-social-login changed. Re-check the patch and update this script.`)
    process.exit(1)
  }
  if (status === 'patched') writeFileSync(file, content)
  console.log(`[patch-plugins] ${label} — ${status}`)
}

function main() {
  patchFile(APPLE_PROVIDER_JAVA, applyAppleProviderCancel, 'AppleProvider.java')
  patchFile(SOCIAL_LOGIN_PACKAGE_SWIFT, applyNoFacebookPackage, 'Package.swift (no Facebook)')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
