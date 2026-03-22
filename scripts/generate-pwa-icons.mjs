/**
 * Writes public/icons/icon-192.png and icon-512.png for PWA / manifest.
 * Run: npm run generate-icons
 */
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#E50914" rx="96"/>
  <text x="256" y="330" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="300" font-weight="800">B</text>
</svg>`

for (const size of [192, 512]) {
  const out = join(outDir, `icon-${size}.png`)
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out)
  console.log('Wrote', out)
}
