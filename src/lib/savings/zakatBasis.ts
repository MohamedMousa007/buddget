import type { ZakatConfig } from '@/lib/store/types'

/** Any config saved before the basis prompt existed counts as a deliberate choice. */
export function zakatBasisChosen(cfg: ZakatConfig | null | undefined): boolean {
  return cfg != null && (cfg.nisabBasisChosen ?? true)
}

/** Gold until the user picks: the safer fallback while nothing was chosen. */
export function effectiveNisabBasis(cfg: ZakatConfig | null | undefined): 'silver' | 'gold' {
  return cfg?.nisabBasis ?? 'gold'
}

/** `cfg` with the basis set and recorded as an explicit choice. */
export function withNisabBasis(cfg: ZakatConfig | null | undefined, nisabBasis: 'silver' | 'gold'): ZakatConfig {
  return { holdsForTrading: false, ...cfg, nisabBasis, nisabBasisChosen: true }
}
