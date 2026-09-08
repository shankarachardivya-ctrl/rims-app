/**
 * Google Picker — lets the user choose their inventory workbook.
 *
 * This is what makes the narrow `drive.file` scope workable: selecting a file
 * in the Picker grants this app access to that file alone. Without the Picker
 * we would have to request access to the user's entire Drive.
 *
 * Shared Drives are enabled, since keeping the workbook in a Shared Drive is
 * the recommended way to survive the loss of any single Google account.
 */

import { GOOGLE_API_KEY, GOOGLE_PROJECT_NUMBER } from '@/lib/constants'
import { getAccessToken, loadPickerApi, GoogleAuthError } from './googleAuth'

export interface PickedSheet {
  id: string
  name: string
  url?: string
}

const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet'

/**
 * Open the Picker and resolve with the chosen spreadsheet,
 * or null if the user cancelled.
 */
export async function pickSpreadsheet(): Promise<PickedSheet | null> {
  if (!GOOGLE_API_KEY) {
    throw new GoogleAuthError(
      'VITE_GOOGLE_API_KEY is not set, so the Google Picker cannot open.'
    )
  }

  const token = await getAccessToken(true)
  await loadPickerApi()

  if (!window.google?.picker) {
    throw new GoogleAuthError('Google Picker failed to load')
  }

  return await new Promise<PickedSheet | null>((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes(SPREADSHEET_MIME)

    const builder = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setTitle('Select your RIMS inventory workbook')
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .setCallback((data) => {
        // 'loaded' fires first and carries no selection
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs?.[0]
          picker.dispose()
          resolve(doc ? { id: doc.id, name: doc.name ?? 'Untitled', url: doc.url } : null)
        } else if (data.action === google.picker.Action.CANCEL) {
          picker.dispose()
          resolve(null)
        }
      })

    // appId is required for drive.file grants to stick to this project
    if (GOOGLE_PROJECT_NUMBER) builder.setAppId(GOOGLE_PROJECT_NUMBER)

    const picker = builder.build()
    picker.setVisible(true)
  })
}

/**
 * Extract a spreadsheet id from a pasted Google Sheets URL, as a fallback for
 * anyone who would rather paste a link than use the Picker.
 *
 * Note: a pasted id does NOT grant drive.file access on its own — the file must
 * still have been opened through the Picker at least once, or the Sheets call
 * will come back 403.
 */
export function extractSpreadsheetId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  // Full URL form
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (m) return m[1]
  // Bare id
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s
  return null
}
