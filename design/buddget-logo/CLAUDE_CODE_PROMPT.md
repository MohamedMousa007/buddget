# Implementation prompt: Buddget logo

Paste everything below the line into Claude Code, run from the root of `MohamedMousa007/buddget`, with this `handoff/buddget-logo/` folder copied into the repo.

---

You are replacing the Buddget logo and app icons everywhere in this repo (Next.js 16 app router, React 19, Tailwind v4, Capacitor 8). Every asset is final and lives in `handoff/buddget-logo/`. Integrate it exactly. Do not redraw, re-export, optimise or "improve" any artwork.

## Sources of truth
1. `handoff/buddget-logo/code/*.tsx`: geometry. Copy the path data byte for byte.
2. `handoff/buddget-logo/README.md`: colours, clear space, minimum sizes.
3. `handoff/buddget-logo/proofs/*.png`: check your output against these visually.

If something is not specified, stop and ask.

## Hard rules
- Never run SVGO or any path merging on these SVGs, and never convert the wordmark back to live text. It is outlined on purpose.
- Colours: teal `#12B0A0` light / `#1FC3B2` dark via `--color-brand-primary-bright`; ink via `--color-brand-text-primary`; icon background `#0E9384 → #0A534A`. No other colours. Remove every remaining use of the old red `#E50914` related to icons, theme colour or notifications.
- The wordmark always renders `dir="ltr"`, including in Arabic.
- Mark ≥ 16px; wordmark ≥ 18px tall.

## Tasks
1. **Components.** Copy `code/BuddgetMark.tsx` and `code/BuddgetWordmark.tsx` to `src/components/brand/`. Export both from an `index.ts`.
2. **Replace existing logo usage.** Search `src/` for the current logo (text "Buddget" rendered as a logo, `<img src="/icons/...">`, any `Logo` component). Replace it with:
   - Web and desktop header, auth screens, landing and legal: `<BuddgetWordmark height={24} />`.
   - Compact spots (collapsed sidebar, splash overlays, loading states): `<BuddgetMark size={26} />`.
   - The native mobile header stays avatar + greeting only (DS rule). Don't add the logo there.
3. **Web icons.** Overwrite the repo files with the ones in `handoff/buddget-logo/public/`, keeping the same names:
   `public/favicon.ico`, `public/icons/favicon.ico`, `public/icons/icon.svg`, `public/icons/icon-16.png`, `icon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `apple-touch-icon.svg`. Add the new `public/icons/icon-48.png` and `public/icons/icon-maskable-512.png`.
4. **Manifest.** Replace `public/manifest.json` with `code/manifest.json`. It sets `theme_color` to `#12B0A0`, `background_color` to `#0A100F`, adds the SVG icon, and points `maskable` at `icon-maskable-512.png` instead of reusing `icon-512.png`.
5. **Open Graph.** If `src/app/opengraph-image.*` exists, make it serve `handoff/buddget-logo/public/opengraph-image.png` (1200×630) as a static file, or copy the PNG to `src/app/opengraph-image.png` and delete the generator. `layout.tsx` already references `/opengraph-image`.
6. **layout.tsx.** Keep the existing `<link>` tags; they already match the file names. Add `<link rel="icon" href="/icons/icon-48.png" type="image/png" sizes="48x48" />`. `viewport.themeColor` is already `#12B0A0`. Leave it.
7. **Native icons and splash (Capacitor).**
   - Copy `handoff/buddget-logo/assets/*` to `/assets` at the repo root.
   - Run `npx @capacitor/assets generate --iconBackgroundColor '#0A534A' --iconBackgroundColorDark '#0A534A' --splashBackgroundColor '#F4F7F6' --splashBackgroundColorDark '#0A100F'`.
   - Android themed icon (Android 13+): copy `png/android/ic_launcher_monochrome-432.png` into each `android/app/src/main/res/mipmap-*` as `ic_launcher_monochrome.png`, scaled to that density's 108dp (mdpi 108, hdpi 162, xhdpi 216, xxhdpi 324, xxxhdpi 432). Then add `<monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>` to `mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml`.
   - iOS: confirm `ios/App/App/Assets.xcassets/AppIcon.appiconset` holds the 1024 opaque icon (`assets/icon-only.png`).
8. **Notification icon.** Copy `handoff/buddget-logo/android/res/drawable-*/ic_stat_buddget.png` to `android/app/src/main/res/drawable-*/`. In `capacitor.config.ts`, set `LocalNotifications.iconColor` to `'#12B0A0'`, and set `SplashScreen.backgroundColor` and `StatusBar.backgroundColor` to `'#0A100F'`.
9. **Clean up.** Delete any old logo assets that are no longer referenced. Don't touch `public/buddgy/` (the mascot is separate).

## Acceptance checks
- The browser tab shows the teal square coin b at 16px in Chrome and Safari, in both light and dark browser themes.
- Lighthouse PWA: the manifest has an `any` icon and a separate `maskable` icon, and maskable.app shows the whole b inside the circle mask.
- The iOS home screen icon has no white corners or double rounding. On a Pixel launcher with a circle mask, the whole b is visible, and the themed icon toggle shows the monochrome b.
- In the app, the header wordmark matches `proofs/wordmark-light-dark.png` in both themes; toggle `.dark` to check.
- `grep -ri "E50914" src public capacitor.config.ts` returns nothing related to icons or theme colour.
