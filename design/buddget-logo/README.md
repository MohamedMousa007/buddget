# Buddget logo — handoff v1.0 (2026-09-28)

Two assets make up the identity:

- **The mark (coin b)**: a lowercase b whose round part is a coin: a stem, a coin ring and a centre dot. It is used for the app icon, the favicon and anywhere a small square symbol is needed.
- **The wordmark**: "buddget" in DM Sans Bold, outlined. The first b is a coin b redrawn at the font's own stem weight, x-height and ascender, so it reads as a normal letter, and the second d is identity teal. There is no separate horizontal lockup, because the b in the word already carries the mark.

## Meaning
The b is the name's first letter and a coin at the same time. It means money, in a plain and friendly way, and it doesn't borrow a bank's authority. Its round forms and single weight keep it calm, and a solid silhouette holds up at 16px.

## Colour (from the Buddget design system only)
| Use | Light | Dark |
|---|---|---|
| Mark / teal d | `#12B0A0` | `#1FC3B2` |
| Wordmark ink | `#0A100F` | `#F4F7F6` |
| Gradient mark | `#12B0A0 → #0B7568` | `#1FC3B2 → #0D8578` |
| App icon background | `#0E9384 → #0A534A` (160°) | same |
| Mark on icon / on teal | `#FFFFFF` | `#FFFFFF` |
| Mono | `#000000` on white | `#FFFFFF` on black |

In code, use `--color-brand-primary-bright` for teal and `--color-brand-text-primary` for ink.

## Geometry (mark, 48-unit grid)
- Stem: rect x11 y5 w6 h37, rx3 (a round-capped stroke of 6)
- Coin ring: centre (26,30), outer r12, inner r6
- Coin dot: centre (26,30), r3.5
- Bounding box: x11–38, y5–42 (27 × 37). The 48 box includes the padding.

## Rules
- **Mark clear space:** the coin's radius (12 units = 25% of the box) on every side of the bounding box.
- **Mark minimum size:** 16px (the box size). Below 20px, use the flat colour, never the gradient.
- **Wordmark clear space:** the height of the coin b's bowl (x-height) on every side.
- **Wordmark minimum:** 18px tall (76px wide). Aspect ratio is 4011 : 952 = 4.2132. Keep it LTR in Arabic layouts.
- Never add a tagline, outline, shadow or bevel, and never recolour the teal d to anything other than identity teal (or mono).
- Use only the colours in the table above.

## Files
| Folder | Contents |
|---|---|
| `svg/` | Mark: teal, teal-dark-mode, gradient, gradient-dark-mode, black, white, on-teal. `app-icon.svg` (1024). Android adaptive `android-foreground.svg` / `android-background.svg` (108dp). Wordmark: light, dark-mode, black, white. |
| `png/` | Transparent 1024px mark PNGs, 1685×400 wordmark PNGs, iOS 1024 icon, Android 432px adaptive layers + monochrome, Play Store 512. |
| `public/` | Drop-in replacements for the repo's `public/`: `favicon.ico` (16/32/48), `icons/icon.svg`, `icon-16/32/48/192/512.png`, `icon-maskable-512.png`, `apple-touch-icon.png/.svg`, `favicon.ico`, plus `opengraph-image.png` (1200×630). |
| `assets/` | Source files for `@capacitor/assets`: `icon-only.png`, `icon-foreground.png`, `icon-background.png` (1024), `splash.png`, `splash-dark.png` (2732). |
| `android/res/drawable-*/ic_stat_buddget.png` | Notification small icon (white silhouette), 24–96px. |
| `code/` | `BuddgetMark.tsx`, `BuddgetWordmark.tsx`, updated `manifest.json`. |
| `proofs/` | Full-resolution proof sheets: sizes 16/26/64/512, app icon masks, on-surface, monochrome, wordmark light/dark. |

The iOS icon is opaque, 1024×1024, with no pre-applied corner radius. On Android, the foreground mark sits inside the 66dp safe circle, so every launcher mask keeps the whole b.
