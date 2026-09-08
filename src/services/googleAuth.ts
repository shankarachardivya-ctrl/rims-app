/**
 * Google sign-in and access-token management.
 *
 * Uses the Google Identity Services token flow: one consent gives us both the
 * user's identity (email, for matching against the Users tab) and an access
 * token for the Sheets API. No Apps Script deployment is involved.
 *
 * Browser token flows cannot obtain refresh tokens, so when a token expires we
 * silently request a new one. Because consent has already been granted, this
 * normally completes without any UI — which is what keeps the user signed in
 * across reloads.
 */

import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '@/lib/constants'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const GAPI_SRC = 'https://apis.google.com/js/api.js'

/** Refresh slightly early so a request never races the expiry. */
const EXPIRY_SKEW_MS = 60_000

export interface GoogleProfile {
  email: string
  name: string
  picture?: string
}

export class GoogleAuthError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'GoogleAuthError'
  }
}

// ─── Script loading ──────────────────────────────────────────────────────────

const scriptPromises = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const existing = scriptPromises.get(src)
  if (existing) return existing

  const p = new Promise<void>((resolve, reject) => {
    const already = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (already) {
      if (already.dataset.loaded === 'true') { resolve(); return }
      already.addEventListener('load', () => resolve())
      already.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
      return
    }
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.defer = true
    el.onload = () => { el.dataset.loaded = 'true'; resolve() }
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(el)
  })

  scriptPromises.set(src, p)
  return p
}

/** Load Google Identity Services. */
export async function loadGis(): Promise<void> {
  await loadScript(GIS_SRC)
  if (!window.google?.accounts?.oauth2) {
    throw new GoogleAuthError('Google Identity Services did not initialise')
  }
}

/** Load the gapi loader and the Picker module. */
export async function loadPickerApi(): Promise<void> {
  await loadScript(GAPI_SRC)
  if (!window.gapi) throw new GoogleAuthError('gapi failed to load')
  if (window.google?.picker) return
  await new Promise<void>((resolve) => { gapi.load('picker', () => resolve()) })
}

// ─── Token management ────────────────────────────────────────────────────────

let tokenClient: google.accounts.oauth2.TokenClient | null = null
let accessToken: string | null = null
let expiresAt = 0
/** De-duplicates concurrent refreshes so we never open two consent flows. */
let inFlight: Promise<string> | null = null

function tokenIsFresh(): boolean {
  return Boolean(accessToken) && Date.now() < expiresAt - EXPIRY_SKEW_MS
}

async function ensureTokenClient(): Promise<google.accounts.oauth2.TokenClient> {
  if (tokenClient) return tokenClient
  if (!GOOGLE_CLIENT_ID) {
    throw new GoogleAuthError(
      'VITE_GOOGLE_CLIENT_ID is not set, so Google sign-in cannot start.'
    )
  }
  await loadGis()

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    // Replaced per request; initTokenClient requires something here.
    callback: () => {},
  })
  return tokenClient
}

/**
 * Obtain a valid access token.
 *
 * @param interactive when false, attempts a silent refresh and rejects rather
 *        than showing a popup — used on app start to restore a session.
 * @param hint email to pre-select, avoiding an account chooser on refresh.
 */
export function getAccessToken(
  interactive = true,
  hint?: string
): Promise<string> {
  if (tokenIsFresh()) return Promise.resolve(accessToken as string)
  if (inFlight) return inFlight

  inFlight = (async () => {
    const client = await ensureTokenClient()

    return await new Promise<string>((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      // Popups can be dismissed without any callback firing, so guard with a timer.
      const timeout = window.setTimeout(() => {
        finish(() => reject(new GoogleAuthError('Google sign-in timed out')))
      }, interactive ? 120_000 : 15_000)

      const cfg: google.accounts.oauth2.TokenClientConfig = {
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (res) => {
          window.clearTimeout(timeout)
          if (res.error || !res.access_token) {
            finish(() => reject(new GoogleAuthError(
              res.error_description || res.error || 'Authorisation failed'
            )))
            return
          }
          accessToken = res.access_token
          expiresAt = Date.now() + res.expires_in * 1000
          finish(() => resolve(res.access_token))
        },
        error_callback: (err) => {
          window.clearTimeout(timeout)
          finish(() => reject(new GoogleAuthError(
            err.message || `Google sign-in failed (${err.type})`
          )))
        },
      }
      if (hint) cfg.hint = hint

      // A fresh client per request so the callbacks above are the live ones.
      const c = google.accounts.oauth2.initTokenClient(cfg)
      tokenClient = c
      void client

      c.requestAccessToken({
        // '' lets Google skip the prompt when consent already exists
        prompt: interactive ? '' : 'none',
        ...(hint ? { hint } : {}),
      })
    })
  })()

  inFlight
    .catch(() => { /* surfaced to the caller */ })
    .finally(() => { inFlight = null })

  return inFlight
}

/** Current token without triggering a request. */
export function peekAccessToken(): string | null {
  return tokenIsFresh() ? accessToken : null
}

/**
 * Try to restore a session without any user interaction.
 * Returns null when consent is missing or has lapsed.
 */
export async function restoreSession(hint?: string): Promise<string | null> {
  try {
    return await getAccessToken(false, hint)
  } catch {
    return null
  }
}

/** Discard the local token and revoke the grant. */
export async function signOut(): Promise<void> {
  const token = accessToken
  accessToken = null
  expiresAt = 0
  tokenClient = null
  if (!token) return
  try {
    await loadGis()
    await new Promise<void>((resolve) => {
      google.accounts.oauth2.revoke(token, () => resolve())
      window.setTimeout(resolve, 3000)
    })
  } catch {
    // Local state is already cleared; a failed revoke is not fatal.
  }
}

/** Called when a Sheets request returns 401 so the next attempt re-authorises. */
export function invalidateToken(): void {
  accessToken = null
  expiresAt = 0
}

// ─── Identity ────────────────────────────────────────────────────────────────

/** Fetch the signed-in user's profile. Requires the email/profile scopes. */
export async function fetchProfile(token: string): Promise<GoogleProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new GoogleAuthError(`Could not read Google profile (HTTP ${res.status})`)
  }
  const json = (await res.json()) as {
    email?: string; name?: string; picture?: string
  }
  if (!json.email) {
    throw new GoogleAuthError('Google did not return an email address')
  }
  return {
    email: json.email,
    name: json.name || json.email,
    picture: json.picture,
  }
}
