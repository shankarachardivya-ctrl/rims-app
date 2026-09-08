import { create } from 'zustand'
import {
  getSheetBinding, setSheetBinding, type SheetBinding,
} from '@/services/sheetConfig'
import { getSpreadsheetInfo, createTabs } from '@/services/sheetsClient'
import { REQUIRED_TABS } from '@/lib/sheetSchema'
import { invalidateCache } from '@/services/sheetsRepo'

export interface TabCheck {
  /** Tabs the app needs that are missing from the workbook. */
  missing: string[]
  /** Tabs found. */
  present: string[]
  title: string
}

interface SheetState {
  binding: SheetBinding | null
  isChecking: boolean
  isCreating: boolean
  check: TabCheck | null
  error: string | null

  /** Bind a workbook and verify its tabs. */
  select: (binding: SheetBinding) => Promise<TabCheck | null>
  /** Create any tabs the app needs but the workbook lacks. */
  createMissing: () => Promise<boolean>
  /** Re-run the tab check against the bound workbook. */
  verify: () => Promise<TabCheck | null>
  clear: () => void
  setError: (error: string | null) => void
}

async function inspect(spreadsheetId: string): Promise<TabCheck> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const have = new Set(info.tabs)
  return {
    title: info.title,
    present: REQUIRED_TABS.filter((t) => have.has(t.name)).map((t) => t.name),
    missing: REQUIRED_TABS.filter((t) => !have.has(t.name)).map((t) => t.name),
  }
}

export const useSheetStore = create<SheetState>((set, get) => ({
  binding: getSheetBinding(),
  isChecking: false,
  isCreating: false,
  check: null,
  error: null,

  select: async (binding) => {
    set({ isChecking: true, error: null })
    try {
      const check = await inspect(binding.id)
      setSheetBinding(binding)
      invalidateCache()
      set({ binding, check, isChecking: false })
      return check
    } catch (err) {
      set({
        isChecking: false,
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  },

  createMissing: async () => {
    const { binding, check } = get()
    if (!binding || !check || check.missing.length === 0) return true

    set({ isCreating: true, error: null })
    try {
      const toCreate = REQUIRED_TABS.filter((t) => check.missing.includes(t.name))
      await createTabs(binding.id, toCreate)
      const fresh = await inspect(binding.id)
      invalidateCache()
      set({ check: fresh, isCreating: false })
      return fresh.missing.length === 0
    } catch (err) {
      set({
        isCreating: false,
        error: err instanceof Error ? err.message : String(err),
      })
      return false
    }
  },

  verify: async () => {
    const { binding } = get()
    if (!binding) return null
    set({ isChecking: true, error: null })
    try {
      const check = await inspect(binding.id)
      set({ check, isChecking: false })
      return check
    } catch (err) {
      set({
        isChecking: false,
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  },

  clear: () => {
    setSheetBinding(null)
    invalidateCache()
    set({ binding: null, check: null, error: null })
  },

  setError: (error) => set({ error }),
}))
