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

/**
 * Whether the silver-or-gold question is worth asking: only when the choice changes the result, i.e. the wealth sits between
 * the silver and the gold line (zakat is due on silver, not on gold). Under both lines nothing is due either way; over both,
 * the same amount is due either way.
 */
export function zakatBasisQuestionNeeded(context: 'none' | 'silverOnly' | 'both', cfg: ZakatConfig | null | undefined): boolean {
  return context === 'silverOnly' && !zakatBasisChosen(cfg)
}

/** `cfg` with `patch` applied; a first save records no basis choice, so the basis prompt still asks. */
export function patchZakatConfig(cfg: ZakatConfig | null | undefined, patch: Partial<ZakatConfig>): ZakatConfig {
  return cfg ? { ...cfg, ...patch } : { holdsForTrading: false, nisabBasis: 'gold', nisabBasisChosen: false, ...patch }
}
