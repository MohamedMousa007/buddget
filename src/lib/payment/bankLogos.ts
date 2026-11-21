import { resolvePaymentBrandKey } from './paymentMethodDefaults'

/**
 * Catalogue brand id -> official logo file in `public/logos/banks/`. Sources and licence notes:
 * `docs/quality/buddget-remediation/bank-logos.md`. A test keeps this map and the folder in step.
 * ADIB Egypt shares ADIB's file (`adib.png`): same brand, same mark.
 */
export const BANK_LOGO_FILES: Record<string, string> = {
  aaib: 'aaib.svg',
  aalex: 'aalex.svg',
  adcb: 'adcb.svg',
  adib: 'adib.png',
  adibeg: 'adib.png',
  ajman: 'ajman.png',
  albarakaeg: 'albarakaeg.svg',
  albilad: 'albilad.svg',
  alhilal: 'alhilal.png',
  alinma: 'alinma.svg',
  aljazira: 'aljazira.png',
  alrajhi: 'alrajhi.svg',
  anb: 'anb.svg',
  bankdhofar: 'bankdhofar.png',
  bankmuscat: 'bankmuscat.svg',
  banqueducaire: 'banqueducaire.png',
  banquemisr: 'banquemisr.svg',
  bbk: 'bbk.png',
  bisb: 'bisb.png',
  boubyan: 'boubyan.svg',
  burgan: 'burgan.svg',
  cbd: 'cbd.png',
  cbq: 'cbq.png',
  cib: 'cib.svg',
  d360: 'd360.svg',
  dib: 'dib.png',
  dohabank: 'dohabank.png',
  emiratesinvestment: 'emiratesinvestment.png',
  emiratesislamic: 'emiratesislamic.svg',
  enbd: 'enbd.svg',
  fab: 'fab.svg',
  faisaleg: 'faisaleg.svg',
  gulfbank: 'gulfbank.png',
  hsbceg: 'hsbceg.svg',
  ilabank: 'ilabank.png',
  kfh: 'kfh.svg',
  liv: 'liv.png',
  mashreq: 'mashreq.png',
  nbb: 'nbb.svg',
  nbe: 'nbe.svg',
  nbf: 'nbf.png',
  nbk: 'nbk.svg',
  nbo: 'nbo.png',
  qib: 'qib.svg',
  qnb: 'qnb.svg',
  qnbeg: 'qnbeg.svg',
  rakbank: 'rakbank.png',
  riyadbank: 'riyadbank.svg',
  sabb: 'sabb.svg',
  sib: 'sib.png',
  snb: 'snb.svg',
  wio: 'wio.png',
}

/** The logo path for a catalogue id, or null when the bank has no file (callers keep the monogram). */
export function bankLogoSrc(brandId: string | null | undefined): string | null {
  const file = brandId ? BANK_LOGO_FILES[brandId] : undefined
  return file ? `/logos/banks/${file}` : null
}

const byName = new Map<string, string | null>()

/** The logo for an account or provider name ("CIB", "Emirates NBD ••1234"), through the catalogue resolver. */
export function bankLogoForName(name: string | null | undefined): string | null {
  if (!name) return null
  let hit = byName.get(name)
  if (hit === undefined) {
    hit = bankLogoSrc(resolvePaymentBrandKey(name))
    byName.set(name, hit)
  }
  return hit
}
