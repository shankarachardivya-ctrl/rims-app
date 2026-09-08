import type { FilamentMaterial, ResinMaterial } from '@/types'

// ─── Google integration ───────────────────────────────────────────────────────
// The app talks to Google Sheets directly via the REST API. There is no Apps
// Script deployment to maintain: the user signs in with Google and picks their
// workbook, and access is granted per-file through the Picker.

/** OAuth 2.0 Web client ID. Cloud Console > Credentials. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/** API key, required by the Picker (not used for Sheets calls). */
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''

/**
 * Cloud project NUMBER (not the project id). The Picker needs it so that
 * files selected by the user are granted to this app under drive.file.
 */
export const GOOGLE_PROJECT_NUMBER = import.meta.env.VITE_GOOGLE_PROJECT_NUMBER || ''

/**
 * Requested OAuth scopes.
 *
 * `drive.file` is deliberately narrow: the app can only touch files the user
 * explicitly selects in the Picker, never their whole Drive. Sheets API
 * accepts this scope for those files.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ')

/** True when the Google integration has been configured. */
export const isGoogleConfigured = () =>
  Boolean(GOOGLE_CLIENT_ID) && Boolean(GOOGLE_API_KEY)

export const FILAMENT_MATERIALS: FilamentMaterial[] = [
  'PLA',
  'PLA Pro',
  'PETG',
  'ABS',
  'TPU',
  'ASA',
  'Nylon',
  'HIPS',
  'PVA',
  'Carbon Fiber',
  'Wood Fill',
  'Other',
]

export const RESIN_MATERIALS: ResinMaterial[] = [
  'Standard Resin',
  'ABS-Like Resin',
  'Water-Washable Resin',
  'Flexible Resin',
  'Castable Resin',
  'Dental Resin',
  'Engineering Resin',
  'Other',
]

export const COMMON_COLORS = [
  'Black',
  'White',
  'Grey',
  'Red',
  'Nuclear Red',
  'Blue',
  'Navy Blue',
  'Green',
  'Olive Green',
  'Yellow',
  'Orange',
  'Purple',
  'Pink',
  'Brown',
  'Gold',
  'Silver',
  'Transparent',
  'Natural',
  'Other',
]

export const LOW_STOCK_THRESHOLD_DEFAULT = 5

// Chart colors
export const CHART_COLORS = {
  stockIn: '#10b981',      // emerald-500
  sales: '#3b82f6',        // blue-500
  internalUse: '#f59e0b',  // amber-500
  filament: '#8b5cf6',     // violet-500
  resin: '#06b6d4',        // cyan-500
  pieColors: [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#06b6d4', '#f97316', '#ec4899',
    '#84cc16', '#14b8a6',
  ],
}
