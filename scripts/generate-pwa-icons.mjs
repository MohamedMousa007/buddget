/**
 * Writes public/icons/icon-192.png and icon-512.png for PWA / manifest / favicon.
 * Source: public/icons/icon.svg (single source of truth).
 * Run: npm run generate-icons
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')
const appDir = join(__dirname, '../src/app')
const svgPath = join(outDir, 'icon.svg')
const svg = readFileSync(svgPath, 'utf8')

for (const size of [192, 512]) {
  const out = join(outDir, `icon-${size}.png`)
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out)
  console.log('Wrote', out)
}

/** Next.js App Router uses `app/icon.png` for the default favicon / tab icon. */
const appIcon = join(appDir, 'icon.png')
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(appIcon)
console.log('Wrote', appIcon)
