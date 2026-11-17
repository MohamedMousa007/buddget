import { Pinyon_Script } from 'next/font/google'

/** The founder card's signature face, loaded like the app's other fonts (next/font, self-hosted at build). Latin glyphs only. */
const pinyon = Pinyon_Script({ subsets: ['latin'], weight: '400', variable: '--font-signature', display: 'swap' })

/** Sets `--font-signature` on the element it is put on. */
export const signatureFontClass = pinyon.variable
