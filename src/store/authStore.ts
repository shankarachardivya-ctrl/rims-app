import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User, token: string) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user, token) =>
        set({ user, token, isAuthenticated: true, isLoading: false }),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      setLoading: (loading) =>
        set({ isLoading: loading }),
    }),
    {
      name: 'rims-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Permission helpers
export const useCanStockIn  = () => useAuthStore((s) => s.user?.canStockIn  ?? false)
export const useCanStockOut = () => useAuthStore((s) => s.user?.canStockOut ?? false)
export const useCanSell     = () => useAuthStore((s) => s.user?.canSell     ?? false)
export const useCanEdit     = () => useAuthStore((s) => s.user?.canEdit     ?? false)
export const useCanDelete   = () => useAuthStore((s) => s.user?.canDelete   ?? false)
export const useIsAdmin     = () => useAuthStore((s) => s.user?.role === 'admin')
