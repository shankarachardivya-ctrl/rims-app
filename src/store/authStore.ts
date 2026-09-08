import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import {
  getAccessToken, fetchProfile, restoreSession, signOut,
  type GoogleProfile,
} from '@/services/googleAuth'
import { apiFindUser } from '@/services/api'
import { getSpreadsheetId } from '@/services/sheetConfig'

/**
 * Outcome of a sign-in attempt.
 *  ok            — signed in and authorised against the Users tab
 *  needs-sheet   — Google is fine, but no workbook has been selected yet
 *  not-listed    — the Google account is not in the Users tab
 *  disabled      — listed but Active = 0
 *  failed        — Google sign-in itself failed
 */
export type SignInResult =
  | { status: 'ok'; user: User }
  | { status: 'needs-sheet'; email: string }
  | { status: 'not-listed'; email: string }
  | { status: 'disabled'; email: string }
  | { status: 'failed'; error: string }

interface AuthState {
  /** Resolved app user, including permissions from the Users tab. */
  user: User | null
  /** Google account details, kept so we can silently restore the session. */
  googleProfile: GoogleProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  signInWithGoogle: () => Promise<SignInResult>
  /** Re-check the Users tab, e.g. straight after a workbook is chosen. */
  authoriseAgainstSheet: () => Promise<SignInResult>
  /** Silent session restore on app start. */
  restore: () => Promise<boolean>
  setUser: (user: User, token?: string) => void
  logout: () => Promise<void>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

async function authorise(profile: GoogleProfile): Promise<SignInResult> {
  if (!getSpreadsheetId()) {
    return { status: 'needs-sheet', email: profile.email }
  }
  const res = await apiFindUser(profile.email)
  if (!res.success || !res.data) {
    return { status: 'not-listed', email: profile.email }
  }
  if (!res.data.active) {
    return { status: 'disabled', email: profile.email }
  }
  return { status: 'ok', user: res.data }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      googleProfile: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      signInWithGoogle: async () => {
        set({ isLoading: true, error: null })
        try {
          const token = await getAccessToken(true)
          const profile = await fetchProfile(token)
          set({ googleProfile: profile })

          const result = await authorise(profile)
          if (result.status === 'ok') {
            set({ user: result.user, isAuthenticated: true, isLoading: false })
          } else {
            set({ isLoading: false })
          }
          return result
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          set({ isLoading: false, error: message })
          return { status: 'failed', error: message }
        }
      },

      authoriseAgainstSheet: async () => {
        const profile = get().googleProfile
        if (!profile) {
          return { status: 'failed', error: 'Sign in with Google first.' }
        }
        set({ isLoading: true, error: null })
        const result = await authorise(profile)
        if (result.status === 'ok') {
          set({ user: result.user, isAuthenticated: true, isLoading: false })
        } else {
          set({ isLoading: false })
        }
        return result
      },

      restore: async () => {
        const { googleProfile, user } = get()
        // Nothing persisted — a full sign-in is required
        if (!googleProfile || !user) return false

        // Access tokens are deliberately not persisted. Ask Google for a fresh
        // one without any UI; consent already exists so this usually succeeds.
        const token = await restoreSession(googleProfile.email)
        if (!token) {
          set({ isAuthenticated: false })
          return false
        }
        set({ isAuthenticated: true })
        return true
      },

      setUser: (user) =>
        set({ user, isAuthenticated: true, isLoading: false, error: null }),

      logout: async () => {
        await signOut()
        set({
          user: null, googleProfile: null,
          isAuthenticated: false, isLoading: false, error: null,
        })
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'rims-auth',
      // The access token is intentionally excluded: it is short-lived and
      // re-obtained silently on start.
      partialize: (state) => ({
        user: state.user,
        googleProfile: state.googleProfile,
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
