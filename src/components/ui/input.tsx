import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { isAndroid } from "@/lib/native/isNative"

/**
 * `size="brand"` is the app's real control height (48px, rounded-xl, elevated
 * fill) and satisfies the design-system rule that every input is h-12. The
 * default is shadcn's h-8 desktop density, kept for compact/admin surfaces.
 */
// `size` must be Omit-ed before being redeclared: the DOM input attribute is a
// number, so a plain intersection collapses to `number & string` = never and the
// prop becomes unusable.
function Input({ className, type, inputMode, onClick, size = "default", ...props }: Omit<React.ComponentProps<"input">, "size"> & { size?: "default" | "brand" }) {
  const handleClick: React.MouseEventHandler<HTMLInputElement> = (e) => {
    if ((type === 'date' || type === 'month') && 'showPicker' in e.currentTarget) {
      try { (e.currentTarget as HTMLInputElement).showPicker() } catch { /* unsupported browser */ }
    }
    onClick?.(e)
  }

  // ponytail: Android enforces the numpad from type="number" regardless of keyboard app
  // (Samsung/OEM keyboards ignore inputMode). iOS honors inputMode but shows a cluttered
  // keypad for type="number", so keep text+decimal there. Split by platform.
  const numeric = type === 'number'
  const resolvedType = numeric && !isAndroid() ? 'text' : type
  const resolvedInputMode = inputMode ?? (numeric ? 'decimal' : undefined)

  return (
    <InputPrimitive
      type={resolvedType}
      inputMode={resolvedInputMode}
      data-slot="input"
      className={cn(
        "w-full min-w-0 border border-input bg-transparent transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        size === "brand"
          ? "h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-base dark:bg-[var(--color-brand-elevated)]"
          : "h-8 rounded-lg px-2.5 py-1 text-base md:text-sm",
        className
      )}
      onClick={handleClick}
      {...props}
    />
  )
}

export { Input }
