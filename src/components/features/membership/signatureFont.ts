import { Aref_Ruqaa, Pinyon_Script } from 'next/font/google'

/** The founder card's signature face, loaded like the app's other fonts (next/font, self-hosted at build). Latin glyphs only. */
const pinyon = Pinyon_Script({ subsets: ['latin'], weight: '400', variable: '--font-signature', display: 'swap' })

/** The Arabic signature face (the guest pass's "من <name>"), loaded only where a page uses it. */
const arefRuqaa = Aref_Ruqaa({ subsets: ['arabic'], weight: '700', variable: '--font-signature-ar', display: 'swap', preload: false })

/** Sets `--font-signature` on the element it is put on. */
export const signatureFontClass = pinyon.variable

/** Sets `--font-signature-ar` on the element it is put on. */
export const arabicSignatureFontClass = arefRuqaa.variable
