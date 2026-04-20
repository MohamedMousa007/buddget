/**
 * CI-enforced sync between the anchor manifest and every `data-tutorial-id`
 * in the codebase. Two tests:
 *
 *   1. Every literal `data-tutorial-id="..."` in src/ must have a manifest
 *      entry (or match an allow-listed dynamic pattern).
 *   2. Every manifest entry must appear somewhere in src/ — dead entries
 *      would rot silently otherwise.
 *
 * Dynamic anchors (interpolated like `nav-${item.label}`) don't appear as
 * string literals in the grep. List their template patterns in
 * `ALLOWED_DYNAMIC_PATTERNS` (checked here via regex).
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ANCHORS, DYNAMIC_ANCHOR_PATTERNS } from '@/lib/tutorial/anchorManifest'

const SRC_ROOT = path.resolve(__dirname, '../../../..', 'src')

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      listSourceFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Extract every literal `data-tutorial-id="..."` + every
 * `'data-tutorial-id': 'literal'` occurrence. Template-interpolated values
 * (backticks with `${...}`) are surfaced as `__TEMPLATE__` so we can map
 * them to `ALLOWED_DYNAMIC_PATTERNS`.
 */
interface Hit {
  file: string
  value: string // literal value, or template shape like `nav-${...}`
  isTemplate: boolean
}

/** Strip block + line comments so regex-grepping doesn't pick up IDs that
 *  appear only in documentation. Intentionally conservative: it doesn't
 *  parse JSX or template literals, just removes `/&#42; … &#42;/` and
 *  `// …` sequences outside strings. Good enough for anchor extraction. */
function stripComments(src: string): string {
  // Block comments.
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '')
  // Line comments — naive but fine for our files: we avoid stripping
  // inside strings by only stripping when `//` starts a segment preceded
  // by whitespace or start-of-line.
  out = out.replace(/(^|[\s>])\/\/[^\n]*/g, '$1')
  return out
}

function extractHits(): Hit[] {
  const hits: Hit[] = []
  const files = listSourceFiles(SRC_ROOT)
  // Match:  data-tutorial-id="..."  OR  data-tutorial-id={'...'}  OR
  //         data-tutorial-id={`...`}  OR  'data-tutorial-id': '...'  OR
  //         useTutorialAnchor<...>('id')  OR  useTutorialAnchor('id')
  const patterns: RegExp[] = [
    /data-tutorial-id=['"]([^'"]+)['"]/g,
    /data-tutorial-id=\{['"]([^'"]+)['"]\}/g,
    /data-tutorial-id=\{`([^`]+)`\}/g,
    /['"]data-tutorial-id['"]\s*:\s*['"]([^'"]+)['"]/g,
    /useTutorialAnchor(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const file of files) {
    const contents = stripComments(fs.readFileSync(file, 'utf8'))
    for (const re of patterns) {
      let match: RegExpExecArray | null
      while ((match = re.exec(contents)) !== null) {
        const raw = match[1]
        const isTemplate = raw.includes('${')
        hits.push({ file, value: raw, isTemplate })
      }
    }
  }
  return hits
}

function matchesDynamicPattern(value: string): boolean {
  // For concrete literals, check against the regex of every known
  // dynamic pattern. Used when a literal happens to look like a
  // dynamic anchor (e.g. `nav-Home` written out by hand somewhere).
  return DYNAMIC_ANCHOR_PATTERNS.some(({ match }) => match.test(value))
}

function matchesDynamicPrefix(templateValue: string): boolean {
  // For template-interpolated anchor strings, accept the value when
  // its leading static portion starts with one of the registered
  // prefixes.
  return DYNAMIC_ANCHOR_PATTERNS.some(({ prefix }) => templateValue.startsWith(prefix))
}

describe('anchor manifest sync', () => {
  const hits = extractHits()

  it('every literal data-tutorial-id in src/ has a manifest entry', () => {
    const manifestKeys = new Set(Object.keys(ANCHORS))
    const orphans = hits
      .filter((h) => !h.isTemplate)
      .filter((h) => !manifestKeys.has(h.value))
      .filter((h) => !matchesDynamicPattern(h.value))
      .map((h) => `${path.relative(SRC_ROOT, h.file)}: "${h.value}"`)
    expect(orphans, 'add these to src/lib/tutorial/anchorManifest.ts').toEqual([])
  })

  it('template-interpolated data-tutorial-ids match an allow-listed prefix', () => {
    const unknownTemplates = hits
      .filter((h) => h.isTemplate)
      .filter((h) => !matchesDynamicPrefix(h.value))
      .map((h) => `${path.relative(SRC_ROOT, h.file)}: \`${h.value}\``)
    expect(
      unknownTemplates,
      'if this is a legitimate dynamic anchor id, add its prefix + regex to DYNAMIC_ANCHOR_PATTERNS',
    ).toEqual([])
  })

  it('every manifest entry is referenced somewhere in src/', () => {
    const referenced = new Set(hits.map((h) => h.value))
    const deadEntries = Object.keys(ANCHORS).filter((id) => {
      if (referenced.has(id)) return false
      // Allow manifest entries whose concrete id matches a registered
      // dynamic prefix — they're referenced via a template in JSX
      // (e.g. `data-tutorial-id={`nav-${label}`}` → ANCHORS['nav-home']
      // is considered referenced).
      if (DYNAMIC_ANCHOR_PATTERNS.some(({ prefix }) => id.startsWith(prefix))) {
        return false
      }
      return true
    })
    expect(
      deadEntries,
      'these manifest entries have no matching data-tutorial-id in src/ — remove them or wire them in',
    ).toEqual([])
  })
})
