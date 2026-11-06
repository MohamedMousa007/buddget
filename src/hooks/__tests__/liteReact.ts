/** Minimal hook runner so a real hook can be driven without a DOM (the repo has no jsdom / testing-library). */
type Effect = { deps: unknown[] | undefined; cleanup?: (() => void) | void; run: () => (() => void) | void }
let cur: Runner | null = null
class Runner<T = unknown> {
  slots: unknown[] = []; i = 0; pending: Effect[] = []; mounted = false; batching = 0; dirty = false; unsubs: (() => void)[] = []
  result: { current: T } = { current: undefined as T }
  constructor(public fn: () => T) {}
  render() {
    for (let n = 0; n < 50; n++) {
      this.dirty = false; cur = this as Runner; this.i = 0; this.pending = []
      this.result.current = this.fn(); cur = null
      for (const e of this.pending) { if (typeof e.cleanup === 'function') e.cleanup(); e.cleanup = e.run() }
      this.mounted = true
      if (!this.dirty) return
    }
    throw new Error('render loop')
  }
  schedule() { this.dirty = true; if (this.batching === 0 && this.mounted) this.render() }
}
const slot = <S,>(init: () => S): [S, Runner] => {
  const r = cur!; const idx = r.i++
  if (!(idx in r.slots)) r.slots[idx] = init()
  return [r.slots[idx] as S, r]
}
const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((d, k) => Object.is(d, b[k]))
/** Value `useContext` returns for a context object; tests set it before rendering. */
export const contextValues = new Map<object, unknown>()
export const hooks = {
  useState<S>(init: S | (() => S)) {
    // eslint-disable-next-line prefer-const -- assigned after the box that closes over it exists
    let rr: Runner
    const [box, r] = slot(() => {
      const b = { v: typeof init === 'function' ? (init as () => S)() : init, set: (n: S | ((p: S) => S)) => {
        const nv = typeof n === 'function' ? (n as (p: S) => S)(b.v) : n
        if (Object.is(nv, b.v)) return
        b.v = nv; rr.schedule()
      } }
      return b
    })
    rr = r
    return [box.v, box.set] as const
  },
  useRef<S>(init: S) { return slot(() => ({ current: init }))[0] },
  useMemo<S>(fn: () => S, deps: unknown[]) {
    const [box] = slot<{ v: S; deps?: unknown[] }>(() => ({ v: undefined as S }))
    if (!same(box.deps, deps)) { box.v = fn(); box.deps = deps }
    return box.v
  },
  useCallback<F>(fn: F, deps: unknown[]): F { return hooks.useMemo(() => fn, deps) },
  useEffect(run: () => (() => void) | void, deps?: unknown[]) {
    const [box, r] = slot<{ eff?: Effect }>(() => ({}))
    if (!box.eff || !deps || !same(box.eff.deps, deps)) {
      const e: Effect = { deps, run, cleanup: box.eff?.cleanup }
      box.eff = e; r.pending.push(e)
    }
  },
  useSyncExternalStore<S>(subscribe: (cb: () => void) => () => void, getSnapshot: () => S) {
    const [box, r] = slot(() => ({ on: false }))
    if (!box.on) { box.on = true; r.unsubs.push(subscribe(() => r.schedule())) }
    return getSnapshot()
  },
  useDebugValue() {}, useId: () => 'lite-id',
  useContext: (ctx: object) => contextValues.get(ctx),
  useLayoutEffect: (run: () => (() => void) | void, deps?: unknown[]): void => hooks.useEffect(run, deps),
}
const live: Runner[] = []
/** Unsubscribes every hook rendered so far, so one test's hooks never react to the next test's store writes. */
export function cleanupLite() {
  for (const r of live.splice(0)) r.unsubs.splice(0).forEach((u) => u())
}
export function renderLite<T>(fn: () => T) {
  const r = new Runner<T>(fn); live.push(r as Runner); r.render()
  return {
    result: r.result,
    act(f: () => void) { r.batching++; try { f() } finally { r.batching-- } if (r.dirty) r.render() },
    async actAsync(f: () => Promise<void>) { r.batching++; try { await f() } finally { r.batching-- } if (r.dirty) r.render() },
  }
}
