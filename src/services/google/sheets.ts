// ---------------------------------------------------------------------------
// Sheets helpers — ensure the FlaminQo ledger spreadsheet exists inside the
// Drive folder, with a header row, and append/read rows.
// ---------------------------------------------------------------------------

import { GoogleAuth } from './auth'
import { GOOGLE, LEDGER_COLUMNS } from '@/config'
import { findChild } from './drive'

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet'
const SHEET_ID_KEY = 'finsutra_ledger_sheet_id'

function cachedId(): string | null {
  try {
    return localStorage.getItem(SHEET_ID_KEY)
  } catch {
    return null
  }
}
function cacheId(id: string) {
  try {
    localStorage.setItem(SHEET_ID_KEY, id)
  } catch {
    /* ignore */
  }
}

async function createSpreadsheet(folderId: string): Promise<string> {
  // 1) create the spreadsheet with the ledger tab
  const create = await GoogleAuth.apiFetch(SHEETS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: GOOGLE.ledgerFileName },
      sheets: [{ properties: { title: GOOGLE.ledgerTab } }],
    }),
  })
  if (!create.ok) throw new Error(`Could not create ledger sheet (${create.status})`)
  const { spreadsheetId } = await create.json()

  // 2) move it into the FlaminQo folder
  await GoogleAuth.apiFetch(
    `${DRIVE}/files/${spreadsheetId}?addParents=${folderId}&removeParents=root&fields=id,parents`,
    { method: 'PATCH' },
  )
  return spreadsheetId
}

/** Locate the ledger sheet in the folder (or create it), ensure header row. */
export async function ensureLedger(folderId: string): Promise<string> {
  let id = cachedId()
  if (id) {
    // verify it still exists / is reachable
    const check = await GoogleAuth.apiFetch(`${DRIVE}/files/${id}?fields=id,trashed`)
    if (!check.ok || (await check.json()).trashed) id = null
  }
  if (!id) {
    const found = await findChild(GOOGLE.ledgerFileName, folderId, SHEET_MIME)
    id = found?.id ?? (await createSpreadsheet(folderId))
    cacheId(id)
  }
  await ensureHeader(id)
  return id
}

async function ensureHeader(spreadsheetId: string) {
  const range = `${GOOGLE.ledgerTab}!A1:${colLetter(LEDGER_COLUMNS.length)}1`
  const r = await GoogleAuth.apiFetch(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(range)}`)
  const data = r.ok ? await r.json() : { values: [] }
  const hasHeader = data.values?.[0]?.length === LEDGER_COLUMNS.length
  if (hasHeader) return
  await GoogleAuth.apiFetch(
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [LEDGER_COLUMNS as unknown as string[]] }),
    },
  )
}

export async function appendRows(spreadsheetId: string, rows: (string | number)[][]) {
  if (rows.length === 0) return
  const range = `${GOOGLE.ledgerTab}!A1`
  const r = await GoogleAuth.apiFetch(
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    },
  )
  if (!r.ok) throw new Error(`Could not append to ledger (${r.status})`)
}

/** Return the set of IDs already present in the sheet (column A, skipping header). */
export async function existingIds(spreadsheetId: string): Promise<Set<string>> {
  const range = `${GOOGLE.ledgerTab}!A2:A`
  const r = await GoogleAuth.apiFetch(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(range)}`)
  if (!r.ok) return new Set()
  const data = await r.json()
  return new Set<string>((data.values ?? []).map((row: string[]) => row[0]).filter(Boolean))
}

/** Read existing rows as {id, evidence, row} so we can dedup and backfill. */
export async function readIdEvidence(
  spreadsheetId: string,
): Promise<{ id: string; evidence: string; row: number }[]> {
  const range = `${GOOGLE.ledgerTab}!A2:M`
  const r = await GoogleAuth.apiFetch(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(range)}`)
  if (!r.ok) return []
  const data = await r.json()
  const rows: string[][] = data.values ?? []
  return rows
    .map((cells, i) => ({ id: cells[0] ?? '', evidence: cells[12] ?? '', row: i + 2 }))
    .filter((x) => x.id)
}

/** Update a single cell, e.g. a1 = 'M5'. */
export async function updateCell(spreadsheetId: string, a1: string, value: string) {
  const range = `${GOOGLE.ledgerTab}!${a1}`
  await GoogleAuth.apiFetch(
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[value]] }),
    },
  )
}

export function spreadsheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`
}

function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
