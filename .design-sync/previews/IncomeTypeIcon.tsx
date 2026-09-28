import { IncomeTypeIcon } from 'buddget'

/* The glyph itself is bare — the app always renders it inside a tinted tile whose fg/bg come
 * from `incomeTypeColors(type)` (INCOME_TYPE_GRID accents). These previews reproduce that tile,
 * because a lone stroke icon on a page background tells a designer nothing about the pairing. */

const ACCENT: Record<string, string> = {
  salary: '#6366F1',
  bonus: '#F5C842',
  side_hustle: '#4DA3FF',
  investment: '#A78BFA',
  savings: '#F5C842',
  debt: '#FF6B6B',
  gift: '#F472B6',
  refund: '#38BDF8',
  other: '#9898B0',
}

/** rgba(accent, .13) — the same tint `incomeTypeColors` computes for the tile background. */
const tint = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.13)`
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 440,
      background: 'var(--color-brand-card)',
      border: '1px solid var(--color-brand-border)',
      borderRadius: 16,
      padding: 16,
    }}
  >
    {children}
  </div>
)

const Tile = ({ type, label }: { type: string; label: string }) => {
  const fg = ACCENT[type]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 64 }}>
      <span
        style={{
          display: 'flex',
          height: 44,
          width: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 11,
          background: tint(fg),
          color: fg,
        }}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <IncomeTypeIcon type={type as any} className="h-5 w-5" />
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: 1.2,
          color: 'var(--color-brand-text-secondary)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

/** The seven types a user can pick by hand, each in its accent tile — the canonical set. */
export const ManualTypes = () => (
  <Card>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <Tile type="salary" label="Salary" />
      <Tile type="bonus" label="Bonus" />
      <Tile type="side_hustle" label="Side hustle" />
      <Tile type="debt" label="Borrowed" />
      <Tile type="gift" label="Gift" />
      <Tile type="refund" label="Refund" />
      <Tile type="other" label="Other" />
    </div>
  </Card>
)

/** Savings and investment income are system-generated — hidden from the manual picker. */
export const SystemTypes = () => (
  <Card>
    <div style={{ display: 'flex', gap: 12 }}>
      <Tile type="savings" label="Savings" />
      <Tile type="investment" label="Investment" />
    </div>
    <p
      style={{
        margin: '14px 0 0',
        fontSize: 11,
        lineHeight: 1.45,
        color: 'var(--color-brand-text-muted)',
      }}
    >
      Written by the vault and portfolio engines — never offered in the add-income sheet.
    </p>
  </Card>
)

/** On the glass hero card the tile is 44px and the glyph 20px, beside the source name. */
export const OnHeroCard = () => (
  <div
    style={{
      width: 440,
      padding: 16,
      borderRadius: 16,
      color: '#fff',
      background: 'linear-gradient(158deg, #6366F122, rgba(255,255,255,.045) 55%), #0f0f15',
      border: '1px solid rgba(255,255,255,.08)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07), 0 8px 24px -12px rgba(0,0,0,.6)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span
        style={{
          display: 'flex',
          height: 44,
          width: 44,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 11,
          background: tint('#6366F1'),
          color: '#6366F1',
        }}
      >
        <IncomeTypeIcon type="salary" className="h-5 w-5" />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>Monthly salary</p>
        <p
          className="font-mono-numbers"
          style={{ margin: '2px 0 0', fontSize: 11, lineHeight: 1.2, color: 'rgba(255,255,255,.65)' }}
        >
          Biweekly · 5 / 20
        </p>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'end' }}>
        <p className="font-mono-numbers" style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
          12,400 <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.55)' }}>SAR</span>
        </p>
      </div>
    </div>
  </div>
)

/** The three sizes in use: 16px in a chip slider, 20px in a row or tile, 24px in an empty state. */
export const Sizes = () => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: '#4DA3FF' }}>
      {(['h-4 w-4', 'h-5 w-5', 'h-6 w-6'] as const).map((cls, i) => (
        <div key={cls} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <IncomeTypeIcon type="side_hustle" className={cls} />
          <span
            className="font-mono-numbers"
            style={{ fontSize: 10, color: 'var(--color-brand-text-muted)' }}
          >
            {[16, 20, 24][i]}px
          </span>
        </div>
      ))}
    </div>
  </Card>
)
