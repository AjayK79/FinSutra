// ---------------------------------------------------------------------------
// FlaminQo Events configuration.
// FinSutra is currently a private internal tool: Google sign-in is allowlisted,
// and all data lives in one private Google Drive folder as a Google Sheet
// (ledger) + monthly evidence subfolders.
// ---------------------------------------------------------------------------

const FOLDER_KEY = 'finsutra_drive_folder_id'
const DEFAULT_FOLDER_ID = '1m1GA2Uwf9AfK8l7vs4tr317f_Q5HPDjJ'

export const GOOGLE = {
  // OAuth scopes: manage the ledger spreadsheet, read/write the Drive folder,
  // and read the signed-in user's email (for the allowlist check).
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ].join(' '),
  ledgerFileName: 'FlaminQo Ledger',
  ledgerTab: 'Ledger',
  evidenceFolderName: 'Evidence',
}

/** Google accounts allowed to sign in. Add Ajay's here when ready. */
export const ALLOWLIST: string[] = ['priyanka@flaminqoevents.com']

export function isAllowed(email?: string | null): boolean {
  if (!email) return false
  return ALLOWLIST.map((e) => e.toLowerCase()).includes(email.toLowerCase())
}

export function getDriveFolderId(): string {
  try {
    return localStorage.getItem(FOLDER_KEY) || DEFAULT_FOLDER_ID
  } catch {
    return DEFAULT_FOLDER_ID
  }
}

export function setDriveFolderId(id: string) {
  try {
    localStorage.setItem(FOLDER_KEY, id.trim())
  } catch {
    /* ignore */
  }
}

/** Column order for the ledger sheet (row 1 header). Change freely — the sheet
 * auto-rebuilds when this changes, and rows are written by column name. */
export const LEDGER_COLUMNS = [
  'ID',
  'Payment Date',
  'Month',
  'Type',
  'Amount',
  'Currency',
  'Event',
  'Party',
  'Party Type',
  'Category',
  'Payment Method',
  'Reference',
  'Description',
  'Evidence',
  'Entered By',
  'Recorded On',
] as const
