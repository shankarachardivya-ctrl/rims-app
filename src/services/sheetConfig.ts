/**
 * Which workbook the app is bound to.
 *
 * Persisted so the user picks their sheet once. The id alone is not a
 * credential: access is granted per-file through the Picker under drive.file.
 */

const STORAGE_KEY = 'rims-sheet'

export interface SheetBinding {
  id: string
  name: string
  url?: string
}

let current: SheetBinding | null = null
let loaded = false

function load(): SheetBinding | null {
  if (loaded) return current
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    current = raw ? (JSON.parse(raw) as SheetBinding) : null
  } catch {
    current = null
  }
  return current
}

export function getSheetBinding(): SheetBinding | null {
  return load()
}

export function getSpreadsheetId(): string | null {
  return load()?.id ?? null
}

export function setSheetBinding(binding: SheetBinding | null): void {
  current = binding
  loaded = true
  try {
    if (binding) localStorage.setItem(STORAGE_KEY, JSON.stringify(binding))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private-mode browsers may refuse storage; in-memory state still works.
  }
}

export class NoSheetError extends Error {
  constructor() {
    super('No inventory workbook selected yet.')
    this.name = 'NoSheetError'
  }
}

/** Spreadsheet id, or throw if the user has not chosen one. */
export function requireSpreadsheetId(): string {
  const id = getSpreadsheetId()
  if (!id) throw new NoSheetError()
  return id
}
