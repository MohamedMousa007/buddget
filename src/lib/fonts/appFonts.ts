import { Geist, IBM_Plex_Sans_Arabic } from 'next/font/google'

/** App fonts (light touch): one variable-weight Geist file serves body, headings and numbers; Arabic is IBM Plex Sans Arabic. */
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-sans-ar',
  weight: ['400', '500', '600', '700'],
  preload: false,
})

/** Put on <body>: globals.css builds the --font-* stacks there from these variables. */
export const appFontClasses = `${geist.variable} ${ibmPlexArabic.variable}`
