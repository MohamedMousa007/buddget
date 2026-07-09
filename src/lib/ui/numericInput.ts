import { isAndroid } from '@/lib/native/isNative'

/**
 * Props to force a numeric keypad on a raw `<input>`.
 *
 * Android enforces the numpad from `type="number"` at the OS input-type level,
 * regardless of keyboard app (Samsung/OEM keyboards ignore `inputMode`). iOS
 * honors `inputMode` and renders a cluttered keypad for `type="number"`, so keep
 * `text` + `inputMode` there. Spread into the input: `<input {...numericInput()} />`.
 */
export function numericInput(mode: 'decimal' | 'numeric' = 'decimal') {
  return isAndroid()
    ? ({ type: 'number' } as const)
    : ({ type: 'text', inputMode: mode } as const)
}
