import { BuddgyIcon } from 'buddget'

const MOODS = ['idle','small','listening','thinking','scanning','done','happy','alert','error','offline'] as const

const Orb = ({ children, size }: { children: React.ReactNode; size: number }) => (
  <div
    style={{
      width: size + 20, height: size + 20, display: 'grid', placeItems: 'center',
      borderRadius: 999, border: '1.5px solid var(--color-brand-border)',
      background: 'var(--color-brand-elevated)', color: 'var(--color-brand-text)',
    }}
  >
    {children}
  </div>
)

const Grid = ({ size }: { size: number }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
    {MOODS.map((m) => (
      <div key={m} style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
        <Orb size={size}><BuddgyIcon mood={m} size={size} /></Orb>
        <span style={{ fontSize: 10, color: 'var(--color-brand-text-muted)' }}>{m}</span>
      </div>
    ))}
  </div>
)

/** All ten moods at orb size. One helmet, ten faces. */
export const AllMoods = () => <div style={{ width: 640 }}><Grid size={24} /></div>

/**
 * 16px. `idle` automatically renders the `small` face here — the B is illegible
 * at this size, so the component swaps it rather than shrinking an unreadable glyph.
 */
export const SmallSizes = () => <div style={{ width: 560 }}><Grid size={16} /></div>

/** 64px — chat empty state and the voice capture overlay. */
export const Large = () => (
  <div style={{ width: 640, display: 'flex', flexWrap: 'wrap', gap: 18 }}>
    {(['idle','listening','thinking','scanning','done'] as const).map((m) => (
      <Orb key={m} size={64}><BuddgyIcon mood={m} size={64} /></Orb>
    ))}
  </div>
)

/** Outline variant — single colour, for menus and lists. */
export const OutlineVariant = () => (
  <div style={{ width: 640, display: 'flex', flexWrap: 'wrap', gap: 14, color: 'var(--color-brand-text-secondary)' }}>
    {MOODS.map((m) => <BuddgyIcon key={m} mood={m} size={24} variant="outline" />)}
  </div>
)

/** The ring and glow that go with each mood on the floating orb. */
export const OrbRings = () => {
  const ring = (c: string) => ({
    borderColor: `color-mix(in srgb, ${c} 55%, transparent)`,
    boxShadow: `0 4px 14px -4px color-mix(in srgb, ${c} 55%, transparent)`,
  })
  const teal = 'var(--color-brand-primary-bright)'
  const rows: [string, string, React.CSSProperties][] = [
    ['idle', 'teal', ring(teal)],
    ['done', 'positive', ring('var(--color-brand-green)')],
    ['happy', 'gold', ring('var(--color-brand-gold)')],
    ['alert', 'warning', ring('var(--color-brand-amber)')],
    ['error', 'negative', ring('var(--color-brand-red)')],
    ['offline', 'no glow', { borderColor: 'var(--color-brand-border)' }],
  ]
  return (
    <div style={{ width: 620, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
      {rows.map(([mood, label, style]) => (
        <div key={mood} style={{ display: 'grid', justifyItems: 'center', gap: 7 }}>
          <div
            style={{
              width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 999,
              borderWidth: 1.5, borderStyle: 'solid',
              background: 'var(--color-brand-elevated)', color: 'var(--color-brand-text)', ...style,
            }}
          >
            <BuddgyIcon mood={mood as typeof MOODS[number]} size={24} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--color-brand-text-muted)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}
