#!/usr/bin/env node
/**
 * Patches third-party Capacitor Android plugins for AGP 8+ / Capacitor 8.
 * Re-run after every `npm install` — wired into postinstall and `cap:build`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** [gradle path relative to repo root, namespace value] */
const NAMESPACE_PATCHES = [
  [
    'node_modules/capacitor-sms-retriever/android/build.gradle',
    'com.dwlrathod.plugins',
  ],
]

function patchNamespace(relPath, namespace) {
  const file = resolve(ROOT, relPath)
  if (!existsSync(file)) {
    console.log(`[patch-android] skip ${relPath} — not installed`)
    return
  }
  let content = readFileSync(file, 'utf8')
  if (content.includes(`namespace "${namespace}"`) || content.includes(`namespace '${namespace}'`)) {
    console.log(`[patch-android] ${relPath} — namespace already set`)
    return
  }
  if (!content.includes('android {')) {
    console.warn(`[patch-android] ${relPath} — unexpected layout, patch manually`)
    return
  }
  content = content.replace('android {', `android {\n    namespace "${namespace}"`)
  writeFileSync(file, content)
  console.log(`[patch-android] ${relPath} — added namespace "${namespace}"`)
}

const SMS_PLUGIN_JAVA =
  'node_modules/capacitor-sms-retriever/android/src/main/java/com/dwlrathod/plugins/SmsRetrieverPlugin.java'

/** Capacitor 8 removed PluginCall.error() — use reject() instead. */
function patchSmsRetrieverCapacitor8() {
  const file = resolve(ROOT, SMS_PLUGIN_JAVA)
  if (!existsSync(file)) {
    console.log('[patch-android] skip SmsRetrieverPlugin.java — not installed')
    return
  }
  let content = readFileSync(file, 'utf8')
  if (!content.includes('.error(')) {
    console.log('[patch-android] SmsRetrieverPlugin.java — Capacitor 8 API already patched')
    return
  }
  content = content.replace(/\.error\(/g, '.reject(')
  writeFileSync(file, content)
  console.log('[patch-android] SmsRetrieverPlugin.java — PluginCall.error → reject')
}

for (const [path, ns] of NAMESPACE_PATCHES) {
  patchNamespace(path, ns)
}
patchSmsRetrieverCapacitor8()
