/**
 * Thin wrapper over the Google Sheets REST API (v4).
 *
 * Responsibilities:
 *   - attach the OAuth token, and retry once after refreshing on a 401
 *   - request UNFORMATTED_VALUE so dates arrive as serials we can parse
 *     deterministically rather than as locale-formatted text
 *   - APPEND for the ledger, which never overwrites an existing row
 *
 * Append-only writes are the reason concurrent users cannot lose a transaction:
 * two simultaneous appends both land, even without server-side locking.
 */

import { getAccessToken, invalidateToken } from './googleAuth'
import type { Row } from '@/lib/sheetSchema'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export class SheetsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string
  ) {
    super(message)
    this.name = 'SheetsError'
  }

  /** The workbook is not shared with this app, or was never opened via the Picker. */
  get isAccessProblem(): boolean {
    return this.status === 403 || this.status === 404
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retrying = false
): Promise<T> {
  const token = await getAccessToken(true)

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (res.status === 401 && !retrying) {
    // Token lapsed mid-session — drop it and let the next call re-authorise.
    invalidateToken()
    return request<T>(path, init, true)
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      detail = body.error?.message ?? ''
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new SheetsError(
      humanMessage(res.status, detail),
      res.status,
      detail
    )
  }

  return (await res.json()) as T
}

function humanMessage(status: number, detail: string): string {
  switch (status) {
    case 401:
      return 'Google sign-in expired. Please sign in again.'
    case 403:
      return 'This app does not have access to that workbook. Re-select it so access can be granted.'
    case 404:
      return 'Workbook not found. It may have been deleted or moved.'
    case 429:
      return 'Google is rate limiting requests. Wait a moment and try again.'
    default:
      return detail || `Google Sheets request failed (HTTP ${status})`
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

interface ValueRange {
  range?: string
  majorDimension?: string
  values?: Row[]
}

/**
 * Read one range. Values come back unformatted, so dates are serial numbers
 * and numbers are numbers — see parseSheetDate in sheetSchema.
 */
export async function getValues(
  spreadsheetId: string,
  range: string
): Promise<Row[]> {
  const qs = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  })
  const data = await request<ValueRange>(
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${qs}`
  )
  return data.values ?? []
}

/** Read several ranges in one round trip. Order matches the input. */
export async function batchGetValues(
  spreadsheetId: string,
  ranges: string[]
): Promise<Row[][]> {
  if (ranges.length === 0) return []
  const qs = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  })
  ranges.forEach((r) => qs.append('ranges', r))

  const data = await request<{ valueRanges?: ValueRange[] }>(
    `/${encodeURIComponent(spreadsheetId)}/values:batchGet?${qs}`
  )
  const out = data.valueRanges ?? []
  return ranges.map((_, i) => out[i]?.values ?? [])
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Append rows to the end of a table.
 *
 * USER_ENTERED so date strings become real dates; INSERT_ROWS so we never
 * overwrite a row another user added between our read and our write.
 */
export async function appendRows(
  spreadsheetId: string,
  range: string,
  rows: Row[]
): Promise<void> {
  if (rows.length === 0) return
  const qs = new URLSearchParams({
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
  })
  await request(
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?${qs}`,
    { method: 'POST', body: JSON.stringify({ values: rows }) }
  )
}

/** Overwrite a specific range. Used for Inventory and single-row edits. */
export async function updateValues(
  spreadsheetId: string,
  range: string,
  rows: Row[]
): Promise<void> {
  const qs = new URLSearchParams({ valueInputOption: 'USER_ENTERED' })
  await request(
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${qs}`,
    { method: 'PUT', body: JSON.stringify({ values: rows }) }
  )
}

/** Several range writes in one request. */
export async function batchUpdateValues(
  spreadsheetId: string,
  updates: Array<{ range: string; values: Row[] }>
): Promise<void> {
  if (updates.length === 0) return
  await request(
    `/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updates.map((u) => ({ range: u.range, values: u.values })),
      }),
    }
  )
}

/** Clear a range's contents, leaving formatting intact. */
export async function clearValues(
  spreadsheetId: string,
  range: string
): Promise<void> {
  await request(
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
    { method: 'POST', body: JSON.stringify({}) }
  )
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export interface SpreadsheetInfo {
  spreadsheetId: string
  title: string
  tabs: string[]
}

/** Workbook title and tab names — used to validate the selected sheet. */
export async function getSpreadsheetInfo(
  spreadsheetId: string
): Promise<SpreadsheetInfo> {
  const data = await request<{
    spreadsheetId: string
    properties?: { title?: string }
    sheets?: Array<{ properties?: { title?: string } }>
  }>(`/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties.title`)

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title ?? 'Untitled',
    tabs: (data.sheets ?? [])
      .map((s) => s.properties?.title ?? '')
      .filter(Boolean),
  }
}

/** Create any missing tabs, each with its header row. */
export async function createTabs(
  spreadsheetId: string,
  tabs: Array<{ name: string; columns: readonly string[] }>
): Promise<string[]> {
  if (tabs.length === 0) return []

  await request(`/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: tabs.map((t) => ({ addSheet: { properties: { title: t.name } } })),
    }),
  })

  await batchUpdateValues(
    spreadsheetId,
    tabs.map((t) => ({ range: `${t.name}!A1`, values: [[...t.columns]] }))
  )

  return tabs.map((t) => t.name)
}
