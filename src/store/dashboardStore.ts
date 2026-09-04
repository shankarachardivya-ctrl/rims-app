import { create } from 'zustand'
import type { DashboardData } from '@/types'
import { apiGetDashboard } from '@/services/api'

interface DashboardState {
  data: DashboardData | null
  isLoading: boolean
  error: string | null
  lastFetched: number | null
  fetch: () => Promise<void>
}

const CACHE_TTL_MS = 60_000 // 1 minute cache

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetch: async () => {
    const { lastFetched, isLoading } = get()
    if (isLoading) return
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return

    set({ isLoading: true, error: null })
    const res = await apiGetDashboard()
    if (res.success && res.data) {
      set({ data: res.data, isLoading: false, lastFetched: Date.now() })
    } else {
      set({ isLoading: false, error: res.error ?? 'Failed to load dashboard' })
    }
  },
}))
