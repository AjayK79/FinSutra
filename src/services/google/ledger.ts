// ---------------------------------------------------------------------------
// LedgerSync — the bridge between the local ledger and the FlaminQo Google
// Sheet + evidence folders. Push local transactions as rows; upload evidence
// images into monthly subfolders.
// ---------------------------------------------------------------------------

import { GoogleAuth } from './auth'
import { ensureLedger, appendRows, readIdEvidence, updateCell, spreadsheetUrl, EVIDENCE_COL_LETTER } from './sheets'
import { ensureMonthFolder, uploadFile } from './drive'
import { GOOGLE, getDriveFolderId, LEDGER_COLUMNS } from '@/config'
import type { Transaction, Customer, Vendor, EventRecord } from '@/db/types'

function monthKey(dateISO: string): string {
  return (dateISO || '').slice(0, 7) || new Date().toISOString().slice(0, 7)
}

const TYPE_LABEL: Record<string, string> = {
  income: 'Received',
  expense: 'Paid',
  transfer: 'Transfer',
}

function toRow(
  t: Transaction,
  fields: { event: string; party: string; partyType: string; evidenceUrl: string; enteredBy: string },
): (string | number)[] {
  // Column-name → value, so the sheet order can change freely in config.
  const map: Record<string, string | number> = {
    'ID': t.id,
    'Payment Date': t.date,
    'Month': monthKey(t.date),
    'Type': TYPE_LABEL[t.type] ?? t.type,
    'Amount': t.amount,
    'Currency': t.currency || 'INR',
    'Event': fields.event,
    'Party': fields.party,
    'Party Type': fields.partyType,
    'Category': t.category || '',
    'Payment Method': t.payment_method || '',
    'Reference': t.reference_number || '',
    'Description': t.description || '',
    'Evidence': fields.evidenceUrl,
    'Entered By': fields.enteredBy,
    'Recorded On': t.created_at || '',
  }
  return LEDGER_COLUMNS.map((c) => map[c] ?? '')
}

export interface PushContext {
  customers: Customer[]
  vendors: Vendor[]
  events?: EventRecord[]
  enteredBy: string
  onProgress?: (msg: string) => void
}

export const LedgerSync = {
  spreadsheetUrl,

  /** Ensure the ledger sheet exists (creates it in the folder if needed). */
  async ensure(): Promise<string> {
    return ensureLedger(getDriveFolderId())
  },

  /**
   * Push local transactions to the sheet:
   *  - new transactions become new rows (with evidence uploaded), and
   *  - transactions already in the sheet but missing an evidence link get
   *    their evidence uploaded and back-filled into the Evidence column.
   * Errors during evidence upload are counted, not swallowed.
   */
  async pushAll(
    transactions: Transaction[],
    ctx: PushContext,
    resolveAttachments?: (t: Transaction) => Promise<{ blob: Blob; filename: string } | null>,
  ): Promise<{ pushed: number; evidenceUploaded: number; evidenceFailed: number; url: string }> {
    ctx.onProgress?.('Opening ledger…')
    const sheetId = await this.ensure()
    ctx.onProgress?.('Checking what already exists…')
    const existing = await readIdEvidence(sheetId)
    const byId = new Map(existing.map((r) => [r.id, r]))

    const cName = (id?: string | null) => ctx.customers.find((c) => c.id === id)?.name ?? ''
    const vName = (id?: string | null) => ctx.vendors.find((v) => v.id === id)?.name ?? ''
    const eName = (id?: string | null) => ctx.events?.find((e) => e.id === id)?.name ?? ''

    const active = transactions.filter((t) => !t.deleted_at)
    const newRows: (string | number)[][] = []
    let evidenceUploaded = 0
    let evidenceFailed = 0

    for (const t of active) {
      const row = byId.get(t.id)
      const party = cName(t.customer_id) || vName(t.vendor_id)
      const partyType = t.customer_id ? 'Customer' : t.vendor_id ? 'Vendor' : ''
      const event = eName(t.event_id)

      if (!row) {
        // brand-new entry → upload evidence, then append the row
        let evidenceUrl = ''
        if (resolveAttachments) {
          try {
            const att = await resolveAttachments(t)
            if (att) {
              ctx.onProgress?.('Uploading evidence…')
              evidenceUrl = await this.uploadEvidence(att.blob, att.filename, t.date)
              evidenceUploaded++
            }
          } catch (e) {
            evidenceFailed++
            console.error('Evidence upload failed for', t.id, e)
          }
        }
        newRows.push(toRow(t, { event, party, partyType, evidenceUrl, enteredBy: ctx.enteredBy }))
      } else if (!row.evidence && resolveAttachments) {
        // already in the sheet but no evidence link → back-fill it
        try {
          const att = await resolveAttachments(t)
          if (att) {
            ctx.onProgress?.('Uploading missing evidence…')
            const url = await this.uploadEvidence(att.blob, att.filename, t.date)
            await updateCell(sheetId, `${EVIDENCE_COL_LETTER}${row.row}`, url)
            evidenceUploaded++
          }
        } catch (e) {
          evidenceFailed++
          console.error('Evidence backfill failed for', t.id, e)
        }
      }
    }

    ctx.onProgress?.(`Writing ${newRows.length} row${newRows.length === 1 ? '' : 's'}…`)
    await appendRows(sheetId, newRows)
    return { pushed: newRows.length, evidenceUploaded, evidenceFailed, url: spreadsheetUrl(sheetId) }
  },

  /** Upload one evidence file into Evidence/YYYY-MM; return a viewable link. */
  async uploadEvidence(blob: Blob, filename: string, dateISO: string): Promise<string> {
    const folderId = await ensureMonthFolder(getDriveFolderId(), GOOGLE.evidenceFolderName, monthKey(dateISO))
    const file = await uploadFile(blob, filename, folderId)
    return file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`
  },

  /** Push a single transaction row (used by the live create flow, later). */
  async pushOne(
    t: Transaction,
    fields: { event?: string; party: string; partyType: string; enteredBy: string },
    evidence?: { blob: Blob; filename: string },
  ): Promise<void> {
    const sheetId = await this.ensure()
    let url = ''
    if (evidence) url = await this.uploadEvidence(evidence.blob, evidence.filename, t.date)
    await appendRows(sheetId, [toRow(t, { event: fields.event ?? '', party: fields.party, partyType: fields.partyType, evidenceUrl: url, enteredBy: fields.enteredBy })])
  },

  isReady(): boolean {
    return GoogleAuth.isConfigured() && GoogleAuth.hasSession()
  },
}
