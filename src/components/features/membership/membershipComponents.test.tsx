import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/font/google', () => ({
  Pinyon_Script: () => ({ variable: 'font-signature-var', className: 'font-signature' }),
  Aref_Ruqaa: () => ({ variable: 'font-signature-ar-var', className: 'font-signature-ar' }),
}))

import { initialRig, pointerTilt, rigFrame, stepRig, toggleTarget } from './flipPhysics'
import { CardFace, FlipCardRig } from './FlipCardRig'
import { TIER_BADGE, TIER_ORDER, TIER_PRESS, isTierLocked, ladderRowState, tierPressVars, tierProgressPct, tierRank } from './tiers'
import { TierBadge } from './TierBadge'
import { AvatarBadge } from './AvatarBadge'
import { MemberCard } from './MemberCard'
import { ProMark } from './ProMark'
import { LetterpressTierCard } from './LetterpressTierCard'
import { FounderSignatureFront } from './FounderSignatureCard'
import { GuestPassCardFront } from './GuestPassCard'
import { needsAppFont } from './cardParts'
import { HotStreakCard, streakCellLook, streakCells } from './HotStreakCard'
import { TierLadder } from './TierLadder'
import { FriendRow, InviteEarnedCard, filledSlots } from './InviteBlocks'
import { ManageBar } from './ManageBar'
import { SparksPacks, packBonusSparks, packNote, packTotalSparks } from './SparksPacks'
import { MembershipGallery } from './MembershipGallery'

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)
const count = (s: string, needle: string) => s.split(needle).length - 1

describe('flip physics', () => {
  it('a tap turns the target between front and back', () => {
    expect(toggleTarget(0)).toBe(180)
    expect(toggleTarget(180)).toBe(0)
    expect(initialRig(true)).toMatchObject({ flip: 180, target: 180 })
  })
  it('the spring overshoots, then settles on the back', () => {
    const r = initialRig()
    r.target = 180
    let peak = 0
    for (let i = 0; i < 240; i++) peak = Math.max(peak, stepRig(r, false).flip)
    expect(peak).toBeGreaterThan(180)
    expect(r.flip).toBeCloseTo(180, 1)
  })
  it('lifts and grows mid-turn, and pulls the floor shadow in', () => {
    const r = { ...initialRig(), flip: 90 }
    const f = rigFrame(r, 0, false)
    expect(f.lift).toBe('translateY(-14px)')
    expect(f.card).toContain('scale(1.07)')
    expect(Number(f.floorOpacity)).toBeCloseTo(0.5)
    expect(rigFrame(initialRig(), 0, false).lift).toBe('translateY(0px)')
  })
  // BDG-003: exactly one face is shown at a time, switching at 90 degrees, so the back never shows the front mirrored.
  it('shows the front up to 90 degrees and the back past it', () => {
    expect(rigFrame({ ...initialRig(), flip: 0 }, 0, false).showBack).toBe(false)
    expect(rigFrame({ ...initialRig(), flip: 90 }, 0, false).showBack).toBe(false)
    expect(rigFrame({ ...initialRig(), flip: 91 }, 0, false).showBack).toBe(true)
    expect(rigFrame(initialRig(true), 0, true).showBack).toBe(true)
  })
  it('the pointer tilts the card and moves the light, mirrored on the back', () => {
    expect(pointerTilt(150, 25, { left: 100, top: 0, width: 100, height: 100 })).toEqual({ tx: 0, ty: -0.5 })
    const front = rigFrame({ ...initialRig(), px: 1, hover: 1 }, 0, false)
    expect(front.card).toContain('rotateY(11deg)')
    expect(front.vars['--mx']).toBe('95%')
    expect(front.vars['--ga']).toBe('1')
    const back = rigFrame({ ...initialRig(true), px: 1, hover: 1 }, 0, false)
    expect(back.card).toContain('rotateY(169deg)')
    expect(back.vars['--mx']).toBe('5%')
  })
  it('reduced motion: the flip is instant, with no tilt, float, wobble or hover light', () => {
    const r = { ...initialRig(), tx: 1, ty: 1, px: 0.6, py: 0.6, hover: 1 as const }
    r.target = 180
    stepRig(r, true)
    expect(r).toMatchObject({ flip: 180, flipV: 0, px: 0, py: 0 })
    const f = rigFrame(r, 1.3, true)
    expect(f.lift).toBe('translateY(0px)')
    expect(f.card).toBe('rotateY(180deg) rotateX(0deg) scale(1)')
    expect(f.vars['--ga']).toBe('0')
  })
})

describe('FlipCardRig', () => {
  const rig = (props: object = {}) => html(createElement(FlipCardRig, { label: 'Flip the card', front: <CardFace finish="obsidian">FRONT</CardFace>, back: <CardFace finish="obsidian">BACK</CardFace>, ...props }))
  it('starts on the front: the control is not pressed and the back is hidden from assistive tech', () => {
    const out = rig()
    expect(out).toContain('aria-label="Flip the card"')
    expect(out).toContain('aria-pressed="false"')
    expect(out).toMatch(/aria-hidden="true"[^>]*><div[^>]*>BACK/)
    expect(out).not.toMatch(/aria-hidden="true"[^>]*><div[^>]*>FRONT/)
  })
  it('can start on the back', () => {
    const out = rig({ defaultFlipped: true })
    expect(out).toContain('aria-pressed="true"')
    expect(out).toMatch(/aria-hidden="true"[^>]*><div[^>]*>FRONT/)
  })
  it('the tap target sits outside the turning card, so a moving 3D layer cannot swallow taps', () => {
    const out = rig()
    const button = out.indexOf('<button')
    expect(button).toBeGreaterThan(out.lastIndexOf('BACK'))
    // Closes the back face, its slot, the card and the lift before the button: it is a child of the flat rig.
    expect(count(out.slice(out.lastIndexOf('BACK'), button), '</div>')).toBe(4)
  })
  it('every face carries the sheen and the hover light', () => {
    expect(count(html(<CardFace finish="founder">x</CardFace>), 'aria-hidden="true"')).toBe(2)
  })
})

describe('tiers', () => {
  it('five tiers in rank order, each with a badge metal and a card stock', () => {
    expect(TIER_ORDER).toEqual(['silver', 'emerald', 'diamond', 'elite', 'founder'])
    expect(TIER_ORDER.map(tierRank)).toEqual([1, 2, 3, 4, 5])
    for (const t of TIER_ORDER) {
      expect(TIER_BADGE[t].metal).toHaveLength(5)
      expect(TIER_PRESS[t].foil).toHaveLength(3)
    }
  })
  it('maps a tier to its stock, type and foil colours', () => {
    expect(tierPressVars('emerald')).toEqual({ '--l0': '#1f5a43', '--l1': '#0d2e22', '--lt': '#d9f5e8', '--f0': '#fff3c9', '--f1': '#d9ab45', '--f2': '#8c6a22', '--wm': '#6fe0d0' })
    expect(tierPressVars('silver')).toMatchObject({ '--l0': '#ecebe6', '--lt': '#2a2d2f', '--f1': '#3a4146' })
    expect(tierPressVars('elite')).toMatchObject({ '--l0': '#7a1222', '--l1': '#3a050d' })
    expect(new Set(TIER_ORDER.map((t) => TIER_PRESS[t].stock[0])).size).toBe(5)
  })
  it('only Elite and Elite Founder get the bevel ring; each badge names its tier', () => {
    expect(TIER_ORDER.filter((t) => TIER_BADGE[t].ring)).toEqual(['elite', 'founder'])
    const badge = html(createElement(TierBadge, { tier: 'diamond', size: 16, label: 'Diamond tier' }))
    expect(badge).toContain('aria-label="Diamond tier"')
    expect(badge).toContain('width="16"')
    expect(badge).toContain('#8fd3ff')
    expect(html(createElement(TierBadge, { tier: 'silver' }))).toContain('aria-hidden="true"')
  })
  it('progress runs from the tier floor to the next one, and is full at the top', () => {
    expect(tierProgressPct(540, 300, 800)).toBe(48)
    expect(tierProgressPct(300, 300, 800)).toBe(0)
    expect(tierProgressPct(9999, 300, 800)).toBe(100)
    expect(tierProgressPct(1980, 1500, null)).toBe(100)
  })
  it('Elite and Elite Founder lock without Pro; a trial counts as Pro', () => {
    expect(isTierLocked('elite', false)).toBe(true)
    expect(isTierLocked('founder', false)).toBe(true)
    expect(isTierLocked('elite', true)).toBe(false)
    expect(isTierLocked('diamond', false)).toBe(false)
  })
})

describe('LetterpressTierCard', () => {
  const card = (locked: boolean) => html(createElement(LetterpressTierCard, {
    tier: 'elite', locked, lockLabel: 'Pro members only', flipLabel: 'Rewards card',
    front: { tierName: 'Elite', points: '1,980', pointsUnit: 'pts', name: 'Layla Hassan', progress: 140, nextLine: 'The top tier', rankLine: 'Tier 4 of 5' },
    back: { title: 'Elite perks', perks: ['The crimson card'], footer: ['Member 0042', 'Since Nov 2026'] },
  }))
  it('locked: greyed, with the pill; it still flips', () => {
    const out = card(true)
    expect(out).toContain('data-dimmed="true"')
    expect(out).toContain('Pro members only')
    expect(out).toContain('aria-label="Rewards card"')
  })
  it('unlocked: no pill, the tier colours on both faces, progress clamped', () => {
    const out = card(false)
    expect(out).not.toContain('data-dimmed')
    expect(out).not.toContain('Pro members only')
    expect(count(out, '--l0:#7a1222')).toBe(2)
    expect(out).toContain('width:100%')
    expect(out).toContain('The crimson card')
  })
})

describe('FounderSignatureCard', () => {
  const front = (name: string) => html(createElement(FounderSignatureFront, { mark: 'FOUNDER', number: '#023', name, numberLabel: 'Your number', thanks: 'With thanks' }))
  it('signs a Latin name in the script face', () => {
    expect(needsAppFont('Layla Hassan')).toBe(false)
    expect(needsAppFont("Zoë O'Neil-Çelik")).toBe(false)
    expect(front('Layla Hassan')).toContain('data-signature="script"')
    expect(front('Layla Hassan')).toContain('font-signature-var')
  })
  it('sets an Arabic name in the app font: the script has no Arabic glyphs', () => {
    expect(needsAppFont('ليلى حسن')).toBe(true)
    const out = front('ليلى حسن')
    expect(out).toContain('data-signature="plain"')
    expect(out).not.toContain('font-signature-var')
  })
})

describe('GuestPassCard signature', () => {
  const front = (from?: string) => html(createElement(GuestPassCardFront, {
    mark: 'GUEST PASS', title: '37 Days of Pro', subtitle: 'No card needed · for new accounts', from,
    facts: [{ label: 'Invite code', value: 'MOHAME-7K2', code: true }, { label: 'Friend gets', value: '30 + 7 DAYS' }, { label: 'You get', value: '1 WEEK' }],
  }))
  it('signs "from <name>" on the right in the script face', () => {
    const out = front('from Mohamed')
    expect(out).toContain('from Mohamed')
    expect(out).toContain('data-side="right"')
    expect(out).toContain('dir="ltr"')
    expect(out).toContain('font-signature-var')
  })
  it('sets the Arabic line on the left, right to left, with the Arabic face loaded', () => {
    const out = front('من محمد')
    expect(out).toContain('من محمد')
    expect(out).toContain('data-side="left"')
    expect(out).toContain('dir="rtl"')
    expect(out).toContain('font-signature-ar-var')
  })
  it('a Latin line keeps its side even when the name is Arabic', () => {
    expect(front('from محمد')).toContain('data-side="right"')
  })
  it('draws no signature when the name is unknown', () => {
    for (const out of [front(), front(''), front('   ')]) {
      expect(out).not.toContain('data-side')
      expect(out).not.toContain('font-signature-var')
      expect(out).toContain('37 Days of Pro')
    }
  })
})

describe('HotStreakCard', () => {
  it('always shows 12 weeks, newest last', () => {
    expect(streakCells(['kept', 'current'])).toEqual([...Array(10).fill('missed'), 'kept', 'current'])
    const long = [...Array(13).fill('kept'), 'frozen', 'current'] as const
    expect(streakCells(long)).toHaveLength(12)
    expect(streakCells(long).slice(-2)).toEqual(['frozen', 'current'])
  })
  it('kept burns, frozen is iced, this week is ringed whether or not it is kept yet', () => {
    expect(streakCellLook('kept')).toEqual({ lit: true, frozen: false, now: false, glyph: 'flame' })
    expect(streakCellLook('frozen')).toEqual({ lit: false, frozen: true, now: false, glyph: 'snow' })
    expect(streakCellLook('current')).toEqual({ lit: true, frozen: false, now: true, glyph: 'flame' })
    expect(streakCellLook('pending')).toEqual({ lit: false, frozen: false, now: true, glyph: null })
    expect(streakCellLook('missed')).toEqual({ lit: false, frozen: false, now: false, glyph: null })
  })
  it('draws one cell per week with its state, under one accessible summary', () => {
    const out = html(createElement(HotStreakCard, { title: '6-week streak', points: '+300', pointsLabel: 'points', stripLabel: 'Last 12 weeks', weeks: ['kept', 'frozen', 'missed', 'current'] }))
    expect(count(out, 'data-week=')).toBe(12)
    expect(count(out, 'data-week="missed"')).toBe(9)
    expect(count(out, 'data-week="frozen"')).toBe(1)
    expect(out).toContain('aria-label="Last 12 weeks"')
  })
  it('weeks not reached yet are drawn dashed, and the caption sits under the strip only when given', () => {
    const weeks = ['pending', ...Array(11).fill('future')] as const
    const out = html(createElement(HotStreakCard, { title: 't', points: '+0', pointsLabel: 'p', stripLabel: 'Week 1', weeks, caption: 'Week 1 · since you joined' }))
    expect(count(out, 'data-week="future"')).toBe(11)
    expect(out).toContain('Week 1 · since you joined')
    expect(html(createElement(HotStreakCard, { title: 't', points: '+0', pointsLabel: 'p', stripLabel: 'x', weeks }))).not.toContain('since you joined')
  })
})

describe('TierLadder', () => {
  it('tiers below are done, the member is here, the rest are ahead', () => {
    expect(TIER_ORDER.map((t) => ladderRowState(t, 'diamond'))).toEqual(['done', 'done', 'current', 'ahead', 'ahead'])
    const out = html(createElement(TierLadder, { current: 'diamond', proLabel: 'PRO', hereLabel: 'you are here', rows: TIER_ORDER.map((t) => ({ tier: t, name: t, description: '', threshold: '0' })) }))
    expect(count(out, 'you are here')).toBe(1)
    expect(count(out, 'aria-current="true"')).toBe(1)
    expect(count(out, '>PRO<')).toBe(2)
  })
})

describe('invite blocks', () => {
  it('lights the earned slots and never more than the cap', () => {
    expect(filledSlots(2, 4)).toBe(2)
    expect(filledSlots(9, 4)).toBe(4)
    expect(filledSlots(-1, 4)).toBe(0)
    expect(count(html(createElement(InviteEarnedCard, { title: '2 weeks', monthLabel: '2 of 4', filled: 2 })), 'data-on="true"')).toBe(2)
  })
  it('a friend who is almost there shows the day bar; a pending invite shows a plus', () => {
    const almost = html(createElement(FriendRow, { status: 'almost', initials: 'SM', name: 'Sara M.', detail: 'Active 2 of 3 days', statusLabel: 'Almost there', progress: { done: 2, total: 3 } }))
    expect(count(almost, '<i')).toBe(3)
    const pending = html(createElement(FriendRow, { status: 'pending', initials: 'XX', name: 'Invite sent', detail: 'Waiting', statusLabel: 'Pending' }))
    expect(pending).toContain('>+<')
    expect(pending).not.toContain('XX')
    expect(html(createElement(FriendRow, { status: 'done', initials: 'NA', name: 'Nour', detail: 'Joined', statusLabel: '+1 week', progress: { done: 3, total: 3 } }))).not.toContain('<i')
  })
})

describe('ManageBar', () => {
  it('is a named group of four real buttons', () => {
    const out = html(createElement(ManageBar, { label: 'Manage subscription', status: 'Renews 17 Nov 2027', pill: { label: 'Active', tone: 'positive' }, actions: (['plan', 'manage', 'restore', 'receipts'] as const).map((kind) => ({ kind, label: kind, onClick: () => {}, disabled: kind === 'restore' })) }))
    expect(out).toContain('role="group"')
    expect(count(out, '<button')).toBe(4)
    expect(count(out, 'disabled=""')).toBe(1)
  })
})

describe('SparksPacks', () => {
  const copy = { group: 'Sparks packs', popular: 'Most popular', plain: 'Sparks', bonus: (n: number) => `+${n} Pro bonus`, more: 'More packs', fewer: 'Fewer packs' }
  const packs = [320, 650, 2000].map((n) => ({ id: `sparks_${n}`, sparks: n, price: `EGP ${n}` }))
  const extraPacks = [60, 125].map((n) => ({ id: `sparks_${n}`, sparks: n, price: `EGP ${n}`, tag: 'Egypt' }))
  it('Pro adds 15% to every pack, loyal Pro 20%, Free nothing', () => {
    expect([320, 650, 2000, 60, 125].map((n) => packBonusSparks(n, 15))).toEqual([48, 97, 300, 9, 18])
    expect(packBonusSparks(650, 20)).toBe(130)
    expect(packBonusSparks(650, 0)).toBe(0)
    expect(packTotalSparks({ sparks: 650 }, 15)).toBe(747)
    expect(packTotalSparks({ sparks: 650, bonus: 98 }, 15)).toBe(748)
  })
  it('the line under a pack names the bonus, or just the unit when there is none', () => {
    expect(packNote({ sparks: 650 }, 15, copy)).toBe('+97 Pro bonus')
    expect(packNote({ sparks: 650 }, 0, copy)).toBe('Sparks')
    expect(packNote({ sparks: 650, bonus: 130 }, 15, copy)).toBe('+130 Pro bonus')
  })
  it('shows three packs with the gold tag on the popular one and keeps the rest behind More packs', () => {
    const out = html(createElement(SparksPacks, { packs, extraPacks, selected: 'sparks_650', onSelect: () => {}, popularId: 'sparks_650', bonusPercent: 15, copy }))
    expect(count(out, 'role="radio"')).toBe(3)
    expect(count(out, 'aria-checked="true"')).toBe(1)
    expect(count(out, 'Most popular')).toBe(1)
    expect(out).toContain('+97 Pro bonus')
    expect(out).toContain('More packs')
    expect(out).toContain('aria-expanded="false"')
    expect(out).not.toContain('Egypt')
  })
  it('opens the extra packs when one of them is the selection', () => {
    const out = html(createElement(SparksPacks, { packs, extraPacks, selected: 'sparks_60', onSelect: () => {}, bonusPercent: 0, copy }))
    expect(count(out, 'role="radio"')).toBe(5)
    expect(out).toContain('Fewer packs')
    expect(out).not.toContain('Pro bonus')
  })
})

describe('AvatarBadge', () => {
  it('Pro and trial wear the gold tag; a founder wears the ring', () => {
    const out = html(<AvatarBadge proTag="PRO" founder>LH</AvatarBadge>)
    expect(out).toContain('>PRO<')
    expect(out).toContain('data-founder="true"')
    const plain = html(<AvatarBadge>OK</AvatarBadge>)
    expect(plain).not.toContain('PRO')
    expect(plain).not.toContain('data-founder')
  })
})

describe('MembershipGallery', () => {
  it('renders every component without throwing, in both themes', () => {
    const out = html(createElement(MembershipGallery, {}))
    for (const t of ['Pro card · Trial', 'Rewards card · Elite, locked', 'Founder card · Arabic name', 'Guest pass · Pro inviter', 'Sparks packs · Pro', 'Tier ladder · Elite Founder']) expect(out).toContain(t)
    expect(html(createElement(MembershipGallery, { dark: true }))).toContain('class="dark ')
  })
})

describe('ProMark', () => {
  it.each([['sm'], ['md'], ['lg']] as const)('renders the %s tile: the b, PRO, decorative', (size) => {
    const html = renderToStaticMarkup(createElement(ProMark, { size }))
    expect(html).toContain(`data-pro-mark="${size}"`)
    expect(html).toContain('>b<')
    expect(html).toContain('>PRO<')
    expect(html).toContain('aria-hidden="true"')
  })
  it('a plan that has ended is faded, an active one is not', () => {
    expect(renderToStaticMarkup(createElement(ProMark, { faded: true }))).toContain('data-faded="true"')
    expect(renderToStaticMarkup(createElement(ProMark, {}))).not.toContain('data-faded')
  })
  it('stands in for the Sparkles on the Pro member card', () => {
    const html = renderToStaticMarkup(createElement(MemberCard, { kind: 'pro', mark: 'PRO' }))
    expect(html).toContain('data-pro-mark')
    expect(html).not.toContain('lucide-sparkles')
  })
})
