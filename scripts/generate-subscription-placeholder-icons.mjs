/**
 * Renders catalog “app tile” PNGs for brands without a reliable public favicon URL.
 * Run: node scripts/generate-subscription-placeholder-icons.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEST = path.join(__dirname, '..', 'public', 'subscription-icons')

function tileSvg({ color, letter }) {
  const safe = letter.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="${color}"/>
  <text x="64" y="80" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-size="52" font-weight="700" fill="#ffffff" text-anchor="middle">${safe}</text>
</svg>`
}

async function writePng(filename, opts) {
  const buf = await sharp(Buffer.from(tileSvg(opts), 'utf8')).png().toBuffer()
  const out = path.join(DEST, filename)
  fs.writeFileSync(out, buf)
  console.log('Wrote', out, `(${buf.length} bytes)`)
}

await writePng('weyyak.png', { color: '#E31E24', letter: 'W' })
await writePng('gym.png', { color: '#8B5CF6', letter: 'G' })
