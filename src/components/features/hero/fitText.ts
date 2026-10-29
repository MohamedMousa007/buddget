/** Hero number font-size classes by text length. Short figures keep `base`, so the default look is unchanged. */
export function fitBigNumber(text: string): string {
  if (text.length >= 15) return 'text-[21px]'
  if (text.length >= 12) return 'text-[26px]'
  return 'text-[32px]'
}

/** The 16px strip cells: only long figures (about 99,000,800.79 and up) step down. */
export function fitCellValue(text: string): string {
  if (text.length >= 14) return 'text-[12px]'
  if (text.length >= 12) return 'text-[14px]'
  return 'text-base'
}
