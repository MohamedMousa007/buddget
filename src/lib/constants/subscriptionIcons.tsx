import type { ReactNode } from 'react'

export interface BrandIconDef {
  icon: (size: number) => ReactNode
}

/** Rounded-square app icon (iOS-style), not a circle. */
export function AppIcon({ color, text, size }: { color: string; text: string; size: number }) {
  const r = size * 0.22
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <rect width={size} height={size} rx={r} fill={color} />
      <text
        x="50%"
        y="54%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontSize={size * 0.32}
        fontWeight="600"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      >
        {text}
      </text>
    </svg>
  )
}

function app(color: string, text: string): BrandIconDef {
  return {
    icon: (s) => <AppIcon color={color} text={text} size={s} />,
  }
}

/** Inline SVG / app-style icons per catalog `key`. Fallback uses rounded square in SubscriptionBrandIcon. */
export const BRAND_ICONS: Record<string, BrandIconDef> = {
  netflix: {
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden>
        <rect width="48" height="48" rx="10" fill="#E50914" />
        <path
          d="M16 12h4.5l7.5 16.5V12H32v24h-4.5L20 19.5V36H16V12z"
          fill="white"
        />
      </svg>
    ),
  },
  spotify: {
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden>
        <rect width="48" height="48" rx="10" fill="#1DB954" />
        <path
          d="M24 14c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm4.8 14.5a.7.7 0 01-.95.23c-2.6-1.6-5.9-2-9.8-1.1a.7.7 0 11-.32-1.35c4.2-1 7.8-.55 10.8 1.25.3.18.42.57.27.97zm1.2-3a.9.9 0 01-1.2.28c-3-1.8-7.5-2.4-11-1.3a.9.9 0 11-.5-1.75c4-1.2 9-.6 12.4 1.5.35.22.5.7.3 1.05zm.1-3.2c-3.6-2.2-9.5-2.5-12.9-1.4a1.1 1.1 0 11-.6-2.1c4.5-1.4 11.9-1.1 15.6 1.5a1.1 1.1 0 01-1.1 2z"
          fill="white"
        />
      </svg>
    ),
  },
  youtube_premium: {
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden>
        <rect width="48" height="48" rx="10" fill="#FF0000" />
        <path
          d="M36.2 17.8a3 3 0 00-2.1-2.1C32.2 15 24 15 24 15s-8.2 0-10.1.7a3 3 0 00-2.1 2.1C11 19.7 11 24 11 24s0 4.3.8 6.2a3 3 0 002.1 2.1c1.9.7 10.1.7 10.1.7s8.2 0 10.1-.7a3 3 0 002.1-2.1c.8-1.9.8-6.2.8-6.2s0-4.3-.8-6.2zM21.5 28.5v-9l6.75 4.5-6.75 4.5z"
          fill="white"
        />
      </svg>
    ),
  },
  disney_plus: {
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden>
        <rect width="48" height="48" rx="10" fill="#113CCF" />
        <text
          x="50%"
          y="55%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="white"
          fontSize="11"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          D+
        </text>
      </svg>
    ),
  },
  shahid_vip: app('#00B140', 'S'),
  watchit: app('#FF6B00', 'W'),
  osn_plus: app('#1A1A2E', 'O'),
  apple_music: app('#FC3C44', '♫'),
  apple_tv_plus: app('#000000', 'tv+'),
  prime_video: app('#00A8E1', 'P'),
  icloud: app('#3693F5', '☁'),
  google_one: app('#4285F4', 'G'),
  chatgpt_plus: app('#10A37F', 'AI'),
  claude_pro: app('#D97706', 'C'),
  notion: app('#000000', 'N'),
  gym: app('#8B5CF6', 'G'),
  playstation_plus: app('#003791', 'PS'),
  xbox_gamepass: app('#107C10', 'XB'),
  nordvpn: app('#4687FF', 'N'),
  we_internet: app('#7B2D8E', 'WE'),
  vodafone_eg: app('#E60000', 'V'),
  orange_eg: app('#FF6600', 'O'),
  etisalat_eg: app('#509E2F', 'E'),
  du_home: app('#00B5E2', 'du'),
  etisalat_uae: app('#509E2F', 'e&'),
  hbo_max: app('#5B2EFF', 'H'),
  crunchyroll: app('#F47521', 'C'),
  hulu: app('#1CE783', 'H'),
  paramount_plus: app('#0064FF', 'P'),
  peacock: app('#000000', 'P'),
  mubi: app('#0D0D0D', 'M'),
  starzplay: app('#000000', 'S'),
  anghami: app('#A02F8C', 'A'),
  tod: app('#E31837', 'T'),
  jawwy_tv: app('#FF6600', 'J'),
  yango_play: app('#FFDD00', 'Y'),
  viu: app('#FF6A00', 'V'),
  weyyak: app('#E31E24', 'W'),
  cursor: app('#1E1E1E', 'C'),
  github_copilot: app('#6E40C9', '◆'),
  midjourney: app('#000000', 'MJ'),
  perplexity_pro: app('#20B8CD', 'P'),
  google_gemini: app('#4285F4', 'G'),
  grammarly: app('#15C39A', 'G'),
  dropbox: app('#0061FF', 'D'),
  microsoft_365: app('#D83B01', '365'),
  apple_fitness: app('#69D269', '⌖'),
  myfitnesspal: app('#0066EE', 'M'),
  strava: app('#FC4C02', 'S'),
  zoom_pro: app('#2D8CFF', 'Z'),
  slack_pro: app('#4A154B', 'S'),
  kindle_unlimited: app('#FF9900', 'K'),
  audible: app('#F8991C', 'A'),
  scribd: app('#1E7B85', 'S'),
  expressvpn: app('#DA3940', 'E'),
  surfshark: app('#1B6AEE', 'S'),
  nintendo_switch_online: app('#E60012', 'N'),
  ea_play: app('#FF4747', 'EA'),
  youtube_music: app('#FF0000', 'YM'),
  du_mobile: app('#00B5E2', 'du'),
}
