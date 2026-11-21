import { describe, expect, it, vi } from 'vitest'
import { EDGE_ZONE, SWIPE_THRESHOLD, isIgnoredTarget, startsInEdge, swipeVerdict, type EdgeTarget } from './edgeSwipe'
import { goBack, isTabRoot, type BackDeps } from './goBack'

describe('edge swipe start zone', () => {
  it('starts only within 20pt of the leading edge', () => {
    expect(startsInEdge(0, 390, false)).toBe(true)
    expect(startsInEdge(EDGE_ZONE, 390, false)).toBe(true)
    expect(startsInEdge(EDGE_ZONE + 1, 390, false)).toBe(false)
    expect(startsInEdge(200, 390, false)).toBe(false)
  })
  it('mirrors to the right edge in RTL', () => {
    expect(startsInEdge(385, 390, true)).toBe(true)
    expect(startsInEdge(5, 390, true)).toBe(false)
  })
})

describe('edge swipe verdict', () => {
  it('commits only past the 60pt threshold on release', () => {
    expect(swipeVerdict(SWIPE_THRESHOLD - 1, 0, false, true)).toBe('cancel')
    expect(swipeVerdict(SWIPE_THRESHOLD, 0, false, true)).toBe('back')
    expect(swipeVerdict(120, 10, false, false)).toBe('pending')
  })
  it('rejects a mostly vertical swipe, early and at release', () => {
    expect(swipeVerdict(8, 40, false, false)).toBe('cancel')
    expect(swipeVerdict(80, 50, false, true)).toBe('cancel')
  })
  it('rejects a swipe the wrong way and mirrors in RTL', () => {
    expect(swipeVerdict(-30, 0, false, false)).toBe('cancel')
    expect(swipeVerdict(-80, 0, true, true)).toBe('back')
    expect(swipeVerdict(80, 0, true, true)).toBe('cancel')
  })
})

describe('edge swipe ignored targets', () => {
  const plain = { overflowX: 'visible', touchAction: 'pan-x pan-y' }
  const el = (sel: string | null, extra: Partial<EdgeTarget> = {}, parent: EdgeTarget | null = null): EdgeTarget => ({
    closest: (q: string) => (sel && q.split(', ').some((s) => s === sel) ? {} : null),
    parentElement: parent,
    ...extra,
  })
  it('ignores the Buddgy orb, inputs and sliders', () => {
    for (const s of ['[data-no-ptr]', 'input', 'textarea', 'select', '[role="slider"]']) {
      expect(isIgnoredTarget(el(s), () => plain)).toBe(true)
    }
  })
  it('ignores a horizontal scroller with content to scroll, not one that fits', () => {
    const scroller = el(null, { scrollWidth: 800, clientWidth: 390 })
    const fits = el(null, { scrollWidth: 390, clientWidth: 390 })
    const style = () => ({ overflowX: 'auto', touchAction: 'pan-x pan-y' })
    expect(isIgnoredTarget(el(null, {}, scroller), (e) => (e === scroller ? style() : plain))).toBe(true)
    expect(isIgnoredTarget(el(null, {}, fits), (e) => (e === fits ? style() : plain))).toBe(false)
  })
  it('ignores a finger-driven carousel (touch-action pan-y)', () => {
    const deck = el(null)
    expect(isIgnoredTarget(el(null, {}, deck), (e) => (e === deck ? { overflowX: 'visible', touchAction: 'pan-y' } : plain))).toBe(true)
  })
  it('accepts plain page content', () => {
    expect(isIgnoredTarget(el(null, {}, el(null)), () => plain)).toBe(false)
  })
})

function deps(over: Partial<BackDeps> = {}) {
  return {
    runGuards: vi.fn(() => false),
    modalOpen: false,
    closeModal: vi.fn(),
    overlayLocked: false,
    path: '/goals',
    canGoBack: true,
    historyBack: vi.fn(),
    navigate: vi.fn(),
    ...over,
  }
}

describe('goBack (iOS edge swipe)', () => {
  it('runs the back guards first: an open sheet closes, nothing navigates', () => {
    const d = deps({ runGuards: vi.fn(() => true), modalOpen: true })
    expect(goBack('ios', d)).toBe('guard')
    expect(d.closeModal).not.toHaveBeenCalled()
    expect(d.historyBack).not.toHaveBeenCalled()
  })
  it('closes the active modal before going back', () => {
    const d = deps({ modalOpen: true })
    expect(goBack('ios', d)).toBe('modal')
    expect(d.closeModal).toHaveBeenCalledOnce()
    expect(d.historyBack).not.toHaveBeenCalled()
  })
  it('does nothing under an overlay with no guard', () => {
    const d = deps({ overlayLocked: true })
    expect(goBack('ios', d)).toBe('blocked')
    expect(d.historyBack).not.toHaveBeenCalled()
  })
  it('does nothing on a tab root', () => {
    for (const path of ['/', '/flow', '/accounts', '/wealth', '/debts', '/expenses', '/savings']) {
      const d = deps({ path })
      expect(goBack('ios', d)).toBe('tab-root')
      expect(d.historyBack).not.toHaveBeenCalled()
      expect(d.navigate).not.toHaveBeenCalled()
    }
  })
  it('steps back through history on a non-tab screen', () => {
    const d = deps({ path: '/paydays' })
    expect(goBack('ios', d)).toBe('history')
    expect(d.historyBack).toHaveBeenCalledOnce()
  })
  it('with no history lands on Flow, never leaving the app', () => {
    const d = deps({ canGoBack: false })
    expect(goBack('ios', d)).toBe('home')
    expect(d.navigate).toHaveBeenCalledWith('/flow', { replace: true })
    expect(d.historyBack).not.toHaveBeenCalled()
  })
  it('keeps paydays, budget and settings screens swipeable', () => {
    for (const p of ['/paydays', '/subscriptions', '/budget-setup', '/budget-history', '/settings', '/settings/sms', '/goals', '/reports', '/notifications']) {
      expect(isTabRoot(p)).toBe(false)
    }
  })
})

describe('goBack (Android back, behaviour unchanged)', () => {
  it('guards, then modal, then history, then home', () => {
    expect(goBack('android', deps({ runGuards: () => true }))).toBe('guard')
    expect(goBack('android', deps({ modalOpen: true }))).toBe('modal')
    const h = deps({ path: '/accounts' })
    expect(goBack('android', h)).toBe('history')
    expect(h.historyBack).toHaveBeenCalledOnce()
    const n = deps({ canGoBack: false })
    expect(goBack('android', n)).toBe('home')
    expect(n.navigate).toHaveBeenCalledWith('/')
  })
  it('hands the root to the exit toast', () => {
    const d = deps({ path: '/' })
    expect(goBack('android', d)).toBe('root')
    expect(d.historyBack).not.toHaveBeenCalled()
    expect(d.navigate).not.toHaveBeenCalled()
  })
})
