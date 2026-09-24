// ---------------------------------------------------------------------------
// LedgerSync — the bridge between the local ledger and the FlaminQo Google
// Sheet + evidence folders. Push local transactions as rows; upload evidence
// images into monthly subfolders.
// ---------------------------------------------------------------------------

import { GoogleAuth } from './auth'
import { ensureLedger, appendRows, existingIds, spreadsheetUrl } from './sheets'
import { ensureMonthFolder, uploadFile } from './drive'
import { GOOGLE, getDriveFolderId } from '@/config'
import type { Transaction, Customer, Vendor } from '@/db/types'

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
  party: string,
  partyType: string,
  evidenceUrl: string,
  enteredBy: string,
): (string | number)[] {
  return [
    t.id,
    t.date,
    monthKey(t.date),
    TYPE_LABEL[t.type] ?? t.type,
    t.amount,
    t.currency || 'INR',
    party,
    partyType,
    t.category || '',
    t.payment_method || '',
    t.reference_number || '',
    t.description || '',
    evidenceUrl,
    enteredBy,
    t.created_at || '',
  ]
}

export interface PushContext {
  customers: Customer[]
  vendors: Vendor[]
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
   * Push all local transactions that aren't already in the sheet.
   * Returns how many new rows were added. Evidence images are uploaded for
   * new rows that carry attachments.
   */
  async pushAll(
    transactions: Transaction[],
    ctx: PushContext,
    resolveAttachments?: (t: Transaction) => Promise<{ blob: Blob; filename: string } | null>,
  ): Promise<{ pushed: number; url: string }> {
    ctx.onProgress?.('Opening ledger…')
    const sheetId = await this.ensure()
    ctx.onProgress?.('Checking what already exists…')
    const already = await existingIds(sheetId)

    const cName = (id?: string | null) => ctx.customers.find((c) => c.id === id)?.name ?? ''
    const vName = (id?: string | null) => ctx.vendors.find((v) => v.id === id)?.name ?? ''

    const pending = transactions.filter((t) => !t.deleted_at && !already.has(t.id))
    const rows: (string | number)[][] = []
    let i = 0
    for (const t of pending) {
      i++
      const party = cName(t.customer_id) || vName(t.vendor_id)
      const partyType = t.customer_id ? 'Customer' : t.vendor_id ? 'Vendor' : ''
      let evidenceUrl = ''
      if (resolveAttachments && (t.attachment_ids?.length ?? 0) > 0) {
        try {
          const att = await resolveAttachments(t)
          if (att) {
            ctx.onProgress?.(`Uploading evidence ${i}/${pending.length}…`)
            evidenceUrl = await this.uploadEvidence(att.blob, att.filename, t.date)
          }
        } catch {
          /* non-fatal: keep the row without evidence */
        }
      }
      rows.push(toRow(t, party, partyType, evidenceUrl, ctx.enteredBy))
    }

    ctx.onProgress?.(`Writing ${rows.length} row${rows.length === 1 ? '' : 's'}…`)
    await appendRows(sheetId, rows)
    return { pushed: rows.length, url: spreadsheetUrl(sheetId) }
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
    party: string,
    partyType: string,
    enteredBy: string,
    evidence?: { blob: Blob; filename: string },
  ): Promise<void> {
    const sheetId = await this.ensure()
    let url = ''
    if (evidence) url = await this.uploadEvidence(evidence.blob, evidence.filename, t.date)
    await appendRows(sheetId, [toRow(t, party, partyType, url, enteredBy)])
  },

  isReady(): boolean {
    return GoogleAuth.isConfigured() && GoogleAuth.hasSession()
  },
}
