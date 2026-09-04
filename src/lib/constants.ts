import type { FilamentMaterial, ResinMaterial } from '@/types'

// Replace this with your actual deployed Google Apps Script Web App URL
export const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || ''

// Google OAuth Client ID (from Google Cloud Console)
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

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
