import { DM_Sans, JetBrains_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] })
const dmSansHeading = DM_Sans({ subsets: ['latin'], variable: '--font-heading', weight: ['600', '700'] })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] })
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], variable: '--font-sans-ar', weight: ['400', '500', '600', '700'] })

export const siteFontClasses = [dmSans, dmSansHeading, jetbrainsMono, plexArabic].map((f) => f.variable).join(' ')
