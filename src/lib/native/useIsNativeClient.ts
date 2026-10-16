import { useSyncExternalStore } from 'react'
import { isNative } from '@/lib/native/isNative'

const subscribe = () => () => {}

/** Hydration-safe `isNative()`: false during SSR/hydration, the real value after. */
export function useIsNativeClient(): boolean {
  return useSyncExternalStore(subscribe, isNative, () => false)
}
