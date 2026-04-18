'use client'

import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Tutorial anchoring scaffolding.
 *
 * A future guided-tour library (Shepherd / Driver.js / custom) can plug into
 * this scheme without touching individual feature files: every important
 * surface already carries a stable `data-tutorial-id` attribute + a ref
 * registered here. The provider today is a no-op — it only exists so the
 * shape of `useTutorialAnchor(id)` is stable. When the real tutorial ships,
 * swap the provider body to track registered anchors and emit events; the
 * consumer sites (checklist rows, FAB, KPI grid, nav items, profile menu)
 * stay unchanged.
 *
 * Usage:
 *   const { anchorProps } = useTutorialAnchor('checklist-root')
 *   return <section {...anchorProps}>...</section>
 *
 * Anchor-id naming convention:
 *   - `checklist-root`                       the whole first-run card
 *   - `checklist-row-{income|payments|...}`  each row inside the checklist
 *   - `build-budget-cta`                     the primary dashboard CTA
 *   - `kpi-grid`                             the net-worth/income/etc strip
 *   - `nav-{dashboard|expenses|budget|debts|reports}` bottom-nav items
 *   - `fab-root`                             the global Quick Add FAB
 *   - `profile-menu-trigger`                 the avatar button
 * Only add new ids when a future tutorial step points at them — keep the
 * list short so the map stays skimmable.
 */

type AnchorRegistry = Map<string, RefObject<HTMLElement | null>>

const TutorialContext = createContext<AnchorRegistry | null>(null)

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  // One registry-map shared for the whole app via context. Using `useState`
  // with a lazy initialiser gives us a single stable Map across re-renders
  // without triggering the `react-hooks/refs` rule that forbids reading
  // ref.current during render.
  const [registry] = useState<AnchorRegistry>(() => new Map())
  return <TutorialContext.Provider value={registry}>{children}</TutorialContext.Provider>
}

export interface TutorialAnchorHandle<T extends HTMLElement = HTMLElement> {
  ref: RefObject<T | null>
  anchorProps: {
    'data-tutorial-id': string
    ref: RefObject<T | null>
  }
}

/**
 * Grab a stable anchor for a given tutorial-id. Spread `anchorProps` onto the
 * target element; the ref is registered with the provider so a future tour
 * library can resolve the DOM node by id.
 */
export function useTutorialAnchor<T extends HTMLElement = HTMLElement>(
  id: string,
): TutorialAnchorHandle<T> {
  const ref = useRef<T | null>(null)
  const registry = useContext(TutorialContext)

  useEffect(() => {
    if (!registry) return
    registry.set(id, ref as RefObject<HTMLElement | null>)
    return () => {
      registry.delete(id)
    }
  }, [id, registry])

  return {
    ref,
    anchorProps: {
      'data-tutorial-id': id,
      ref,
    },
  }
}
