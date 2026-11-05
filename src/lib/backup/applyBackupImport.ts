export interface ImportBanner {
  variant: 'success' | 'error'
  text: string
}

interface ImportDeps {
  /** Asks before local data is replaced; resolves true to go ahead. */
  confirm: () => Promise<boolean>
  importData: (text: string) => Promise<void>
  copy: { error: string; success: string }
}

/** Restores a backup file's text. An empty file is an error, and nothing is replaced until the user confirms. Null = cancelled. */
export async function applyBackupImport(text: string | null | undefined, { confirm, importData, copy }: ImportDeps): Promise<ImportBanner | null> {
  if (!text?.trim()) return { variant: 'error', text: copy.error }
  if (!(await confirm())) return null
  try {
    await importData(text)
    return { variant: 'success', text: copy.success }
  } catch (err) {
    return { variant: 'error', text: err instanceof Error ? err.message : copy.error }
  }
}
