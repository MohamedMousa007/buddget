/**
 * Generates the design-system guideline cards from the REAL tokens in globals.css.
 *
 * These cards used to be hand-authored inside Claude Design. Their swatches read
 * `var(--color-brand-*)` so they re-coloured themselves after the teal revamp, but
 * every LABEL and HEX was hardcoded — so the pane went on announcing
 * "Red — primary #E50914" next to a teal-era chip. A card that lies about the
 * system is worse than no card.
 *
 * Both the swatch and its caption now come from the same parsed value, so they
 * cannot disagree.
 *
 *   node .design-sync/gen-guideline-cards.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync('src/app/globals.css', 'utf8')
const OUT = '.design-sync/guidelines'
mkdirSync(OUT, { recursive: true })

/** Read a custom property from the `:root` (light) or `.dark` block. */
function token(name, theme = 'light') {
  const block = theme === 'dark'
    ? css.slice(css.indexOf('\n.dark {'))
    : css.slice(css.indexOf('\n:root {'), css.indexOf('\n.dark {'))
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6}|[^;]+);`))
  if (!m) throw new Error(`token not found: ${name} (${theme})`)
  return m[1].trim()
}

const shell = (title, group, subtitle, viewport, body, extraCss = '') => `<!-- @dsCard group="${group}" viewport="${viewport}" name="${title}" subtitle="${subtitle}" -->
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="../styles.css" />
${group === 'Brand' && title.startsWith('Iconography') ? '<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>' : ''}
<style>
  body { margin: 0; font-family: var(--font-sans); background: var(--color-brand-bg); color: var(--color-brand-text-primary); padding: 20px; }
  .row { display: flex; gap: 14px; }
  .sw { flex: 1; min-width: 0; }
  .chip { height: 64px; border-radius: var(--radius-xl); border: 1px solid var(--color-brand-border); }
  .name { font-size: 12px; font-weight: 600; margin-top: 8px; }
  .hex { font-family: var(--font-mono); font-size: 11px; color: var(--color-brand-text-muted); margin-top: 2px; }
  .note { font-size: 11.5px; color: var(--color-brand-text-secondary); margin-top: 14px; line-height: 1.5; }
  .note b { color: var(--color-brand-text-primary); }
${extraCss}</style>
</head>
<body>
${body}
${group === 'Brand' && title.startsWith('Iconography') ? '<script>lucide.createIcons();</script>' : ''}
</body>
</html>
`

/** One swatch whose caption is derived from the same token it paints with. */
const sw = (label, varName, theme = 'dark') =>
  `    <div class="sw"><div class="chip" style="background:var(${varName})"></div><div class="name">${label}</div><div class="hex">${token(varName, theme)}</div></div>`

const cards = {}

// ── Brand accents ────────────────────────────────────────────────────────────
cards['colors-brand.card.html'] = shell(
  'Brand accents', 'Colors',
  'Teal is the brand and every primary action — red means destructive only',
  '700x230',
  `  <div class="row">
${sw('Teal — primary / CTA', '--color-brand-primary', 'dark')}
${sw('Teal — identity', '--color-brand-primary-bright', 'dark')}
${sw('Green — income', '--color-brand-green', 'dark')}
${sw('Gold — investment', '--color-brand-gold', 'dark')}
${sw('Amber — warning', '--color-brand-amber', 'dark')}
${sw('Red — destructive', '--color-brand-red', 'dark')}
  </div>
  <p class="note"><b>Red is not a CTA colour.</b> It marks destructive actions and over-budget alerts, nothing else — so when it appears it means something. Outflow amounts are plain text, not red.<br />
  <b>Watch the two teals.</b> <code>--color-brand-primary</code> is the fill that text sits on. <code>--color-brand-primary-bright</code> is the identity colour for chart marks, icon glyphs and decorative fills — white on it is only 2.71:1, so it can never carry text.</p>`)

// ── Surfaces ─────────────────────────────────────────────────────────────────
cards['colors-surfaces.card.html'] = shell(
  'Surfaces', 'Colors',
  'Green-tinted neutrals, not grey — they sit under a teal brand',
  '700x200',
  `  <div class="row">
${sw('Background', '--color-brand-bg', 'dark')}
${sw('Card', '--color-brand-card', 'dark')}
${sw('Elevated', '--color-brand-elevated', 'dark')}
${sw('Sunken', '--color-brand-sunken', 'dark')}
${sw('Border', '--color-brand-border', 'dark')}
${sw('Border strong', '--color-brand-border-strong', 'dark')}
  </div>
  <p class="note">Cards are flat by default — reach for <code>--shadow-sm</code> deliberately. The old glass-blur card identity is retired; <code>.glass-card</code> still exists for overlays but is no longer the default look.</p>`)

// ── Text ─────────────────────────────────────────────────────────────────────
cards['colors-text.card.html'] = shell(
  'Text', 'Colors',
  'Three levels — every one clears WCAG AA on card and page',
  '700x200',
  `  <div class="row">
${sw('Primary', '--color-brand-text-primary', 'dark')}
${sw('Secondary', '--color-brand-text-secondary', 'dark')}
${sw('Muted', '--color-brand-text-muted', 'dark')}
  </div>
  <p class="note">Measured on the dark card: primary 15.71:1, secondary 7.47:1, muted 4.95:1. The light-mode values are the <b>minimum darkening</b> from the source mockup that clears 4.5:1 — computed, not eyeballed. Do not lighten them back.</p>`)

// ── Chart / category ramp ────────────────────────────────────────────────────
cards['colors-charts.card.html'] = shell(
  'Chart & category ramp', 'Colors',
  'cat-1…6 in fixed order — charts and category chips share these',
  '700x200',
  `  <div class="row">
${sw('cat-1', '--color-cat-1', 'dark')}
${sw('cat-2', '--color-cat-2', 'dark')}
${sw('cat-3', '--color-cat-3', 'dark')}
${sw('cat-4', '--color-cat-4', 'dark')}
${sw('cat-5', '--color-cat-5', 'dark')}
${sw('cat-6', '--color-cat-6', 'dark')}
  </div>
  <p class="note"><code>--chart-1…5</code> mirror these, so a chart series and its category chip always agree. Light-mode values keep the source ramp wherever it already clears 3:1 as an icon glyph; only cat-1, cat-2 and cat-5 needed darkening.</p>`)

// ── Money semantics ──────────────────────────────────────────────────────────
cards['colors-money.card.html'] = shell(
  'Money semantics', 'Colors',
  'What each colour is allowed to mean',
  '700x220',
  `  <div class="row">
${sw('Money in', '--color-brand-green', 'dark')}
${sw('Received / on track', '--color-brand-green', 'dark')}
${sw('Late / due soon', '--color-brand-amber', 'dark')}
${sw('Over budget', '--color-brand-red', 'dark')}
  </div>
  <p class="note"><b>Money out has no colour.</b> An outflow amount is plain <code>--color-brand-text-primary</code>. Colouring every expense red makes the one genuinely alarming number invisible.<br />
  Direction is never carried by colour alone — always pair it with a sign (+ / −) and the icon treatment.</p>`)

// ── Light theme ──────────────────────────────────────────────────────────────
cards['colors-light.card.html'] = shell(
  'Light theme', 'Colors',
  'Light is the product default — dark is opt-in',
  '700x230',
  `  <div class="row" style="background:${token('--color-brand-bg')};padding:16px;border-radius:var(--radius-2xl)">
    <div class="sw"><div class="chip" style="background:${token('--color-brand-primary')}"></div><div class="name" style="color:${token('--color-brand-text-primary')}">Primary fill</div><div class="hex">${token('--color-brand-primary')}</div></div>
    <div class="sw"><div class="chip" style="background:${token('--color-brand-primary-bright')}"></div><div class="name" style="color:${token('--color-brand-text-primary')}">Identity teal</div><div class="hex">${token('--color-brand-primary-bright')}</div></div>
    <div class="sw"><div class="chip" style="background:${token('--color-brand-card')}"></div><div class="name" style="color:${token('--color-brand-text-primary')}">Card</div><div class="hex">${token('--color-brand-card')}</div></div>
    <div class="sw"><div class="chip" style="background:${token('--color-brand-green')}"></div><div class="name" style="color:${token('--color-brand-text-primary')}">Income</div><div class="hex">${token('--color-brand-green')}</div></div>
    <div class="sw"><div class="chip" style="background:${token('--color-brand-red')}"></div><div class="name" style="color:${token('--color-brand-text-primary')}">Destructive</div><div class="hex">${token('--color-brand-red')}</div></div>
  </div>
  <p class="note">A user with no stored preference — including one whose browser blocks storage — gets light. The primary fill is <b>${token('--color-brand-primary')}</b>: the lightest point on the teal ramp that still clears 4.5:1 with white text. It cannot go lighter; button labels are 15px semibold, which is not WCAG "large text".</p>`)

// ── Radius ───────────────────────────────────────────────────────────────────
cards['spacing-radius.card.html'] = shell(
  'Radius', 'Spacing',
  'Controls 12px · cards 16px · sheet tops 24px',
  '700x190',
  `  <div class="row">
    <div class="sw"><div class="chip" style="background:var(--color-brand-elevated);border-radius:var(--radius-xl)"></div><div class="name">Buttons &amp; inputs</div><div class="hex">12px · rounded-xl</div></div>
    <div class="sw"><div class="chip" style="background:var(--color-brand-elevated);border-radius:var(--radius-2xl)"></div><div class="name">Cards &amp; tiles</div><div class="hex">16px · rounded-2xl</div></div>
    <div class="sw"><div class="chip" style="background:var(--color-brand-elevated);border-radius:var(--radius-3xl) var(--radius-3xl) 0 0"></div><div class="name">Sheet tops</div><div class="hex">24px · rounded-3xl</div></div>
    <div class="sw"><div class="chip" style="background:var(--color-brand-elevated);border-radius:999px"></div><div class="name">Chips &amp; badges</div><div class="hex">full</div></div>
    <div class="sw"><div class="chip" style="background:var(--color-brand-primary);border-radius:18px;width:54px;height:54px;flex:none"></div><div class="name">FAB</div><div class="hex">54px · radius 18</div></div>
  </div>
  <p class="note">Every form input, select and trigger is <b>48px</b> tall. No tap target below <b>44×44px</b>.</p>`)

// ── Elevation ────────────────────────────────────────────────────────────────
cards['spacing-elevation.card.html'] = shell(
  'Elevation', 'Spacing',
  'Three steps — cards are flat by default',
  '700x190',
  `  <div class="row" style="gap:22px">
    <div class="sw"><div class="chip" style="background:var(--color-brand-card);box-shadow:var(--shadow-sm)"></div><div class="name">shadow-sm</div><div class="hex">resting card</div></div>
    <div class="sw"><div class="chip" style="background:var(--color-brand-card);box-shadow:var(--shadow-md)"></div><div class="name">shadow-md</div><div class="hex">raised</div></div>
    <div class="sw"><div class="chip" style="background:var(--color-brand-card);box-shadow:var(--shadow-lg)"></div><div class="name">shadow-lg</div><div class="hex">modal / sheet</div></div>
  </div>
  <p class="note">Replaces the old glass-blur card identity. Reach for elevation deliberately — a page where everything floats has no hierarchy.</p>`)

// ── Logo ─────────────────────────────────────────────────────────────────────
cards['brand-logo.card.html'] = shell(
  'Wordmark', 'Brand',
  'Buddget with the accented d — now teal',
  '700x200',
  `  <div style="display:flex;align-items:center;gap:36px">
    <div>
      <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em">Bud<b style="color:var(--color-brand-primary-bright)">d</b>get</div>
      <div style="font-size:12px;color:var(--color-brand-text-muted);margin-top:4px">Your money, finally makes sense</div>
    </div>
    <div style="font-size:11.5px;color:var(--color-brand-text-secondary);line-height:1.6;max-width:320px">
      The accent sits on the second <b>d</b> and uses <code>--color-brand-primary-bright</code>.<br />
      <b>A new logo mark is being designed</b> — see <code>design/design_handoff_logo/</code>. Until it lands there is no approved icon; do not reuse the old red square.
    </div>
  </div>`)

// ── Glass (demoted) ──────────────────────────────────────────────────────────
cards['spacing-glass.card.html'] = shell(
  'Glass surface', 'Spacing',
  'No longer the default card — kept for overlays only',
  '700x220',
  `  <div class="glass-card" style="border-radius:var(--radius-2xl);padding:20px 22px;max-width:340px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--color-brand-text-secondary)">Left to spend</div>
    <div class="font-mono" style="font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:30px;font-weight:700;margin-top:6px">4,180.00</div>
    <div style="font-size:12px;color:var(--color-brand-text-muted);margin-top:6px">.glass-card · backdrop-blur(12px)</div>
  </div>
  <p class="note"><b>Cards are solid surfaces now</b> — <code>--color-brand-card</code> with <code>--shadow-sm</code>. Glass was the old signature look and is retired as the default; use <code>.glass-card</code> only where something genuinely floats over content, such as an overlay.</p>`,
  `  body { background:
      radial-gradient(420px 200px at 18% 10%, color-mix(in srgb, var(--color-brand-primary-bright) 26%, transparent), transparent 60%),
      radial-gradient(420px 220px at 85% 90%, color-mix(in srgb, var(--color-brand-green) 20%, transparent), transparent 60%),
      var(--color-brand-bg); }
`)

// ── Iconography ──────────────────────────────────────────────────────────────
// The previous hand-authored version of this card shipped `piggy-bank` as the
// savings icon and coloured the active nav item red. Both are now prohibited.
cards['brand-icons.card.html'] = shell(
  'Iconography — Lucide', 'Brand',
  'Outline, 1.75–2px stroke · never a pig, never a bell on native',
  '700x250',
  `  <div class="grid">
    <div class="item on"><i data-lucide="layout-dashboard"></i><div class="cap">home</div></div>
    <div class="item"><i data-lucide="receipt"></i><div class="cap">expenses</div></div>
    <div class="item"><i data-lucide="landmark"></i><div class="cap">debts</div></div>
    <div class="item"><i data-lucide="coins"></i><div class="cap">savings</div></div>
    <div class="item"><i data-lucide="bar-chart-3"></i><div class="cap">reports</div></div>
    <div class="item"><i data-lucide="utensils-crossed"></i><div class="cap">dining</div></div>
    <div class="item"><i data-lucide="car"></i><div class="cap">transport</div></div>
    <div class="item"><i data-lucide="plus"></i><div class="cap">add</div></div>
  </div>
  <p class="note">🚫 <b>Never a pig.</b> <code>piggy-bank</code> is prohibited product-wide for savings or anything else — this is a religious constraint for the app's audience, not a style preference. The canonical savings glyph is <b><code>coins</code></b>.<br />
  🚫 <b>No notification bell on native.</b> The mobile header is avatar + greeting only.<br />
  The active nav item is <b>teal</b>, not red.</p>`,
  `  body { background: var(--color-brand-card); }
  .grid { display: flex; gap: 26px; flex-wrap: wrap; }
  .item { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 64px; }
  .item i { color: var(--color-brand-text-secondary); }
  .item.on i { color: var(--color-brand-primary-bright); }
  .cap { font-family: var(--font-mono); font-size: 10px; color: var(--color-brand-text-muted); }
  svg.lucide { width: 28px; height: 28px; stroke-width: 1.75; }
`)

for (const [name, html] of Object.entries(cards)) {
  writeFileSync(join(OUT, name), html)
  console.log('  ✓', name)
}
console.log(`${Object.keys(cards).length} guideline card(s) generated from globals.css`)
