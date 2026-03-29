import { ImageResponse } from 'next/og'

/** Node.js runtime keeps the OG route under Vercel’s Edge 1 MB limit (ImageResponse + deps exceed Edge). */
export const runtime = 'nodejs'
export const alt = 'Buddget — Personal Finance Tracker'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0F',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: 'white',
            letterSpacing: -3,
            display: 'flex',
            alignItems: 'baseline',
          }}
        >
          Bud<span style={{ color: '#E50914' }}>d</span>get
        </div>
        <div style={{ fontSize: 32, color: '#A0A0B8', marginTop: 20 }}>Your money, finally makes sense.</div>
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            height: 8,
            background: '#E50914',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
