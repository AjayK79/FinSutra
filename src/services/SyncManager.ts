// ---------------------------------------------------------------------------
// SyncManager — orchestrates backup + event-based sync against the configured
// Drive (real or demo). The local DB is always authoritative; sync pushes
// pending change-events and full data snapshots, then marks events synced.
// ---------------------------------------------------------------------------

import { db } from '@/db/database'
import { deviceId } from '@/lib/id'
import { getDrive } from './GoogleDriveService'
import { BackupService } from './BackupService'
import type { SyncMetadata, Transaction } from '@/db/types'

const CONFLICT_KEY = 'finsutra_conflicts'

export interface SyncConflict {
  id: string
  entity_type: string
  entity_id: string
  field: string
  local: string
  cloud: string
  localRecord: unknown
  cloudRecord: unknown
}

export interface SyncResult {
  pushed: number
  pulled: number
  conflicts: number
  at: string
}

export const SyncManager = {
  async getMetadata(): Promise<SyncMetadata> {
    const id = deviceId()
    let meta = await db.sync_metadata.get(id)
    if (!meta) {
      meta = {
        device_id: id,
        sync_version: 0,
        connected: false,
        demo_mode: getDrive().demo,
      }
      await db.sync_metadata.put(meta)
    }
    return meta
  },

  async setMetadata(patch: Partial<SyncMetadata>) {
    const meta = await this.getMetadata()
    const next = { ...meta, ...patch }
    await db.sync_metadata.put(next)
    return next
  },

  async pendingCount(): Promise<number> {
    return db.sync_events.where('sync_status').equals('pending').count()
  },

  isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine
  },

  async connect() {
    const drive = getDrive()
    const status = await drive.connect()
    await this.setMetadata({
      connected: status.connected,
      demo_mode: drive.demo,
      drive_email: status.email,
    })
    return status
  },

  async disconnect() {
    const drive = getDrive()
    await drive.disconnect()
    await this.setMetadata({ connected: false })
  },

  /** Push all pending events + a full snapshot to Drive. */
  async sync(onProgress?: (msg: string) => void): Promise<SyncResult> {
    const drive = getDrive()
    if (!this.isOnline()) throw new Error('You are offline. Changes will sync when you reconnect.')
    const status = drive.status()
    if (!status.connected) throw new Error('Google Drive is not connected.')

    onProgress?.('Preparing local changes…')
    const pending = await db.sync_events.where('sync_status').equals('pending').toArray()

    onProgress?.('Ensuring Drive folders…')
    await drive.ensureStructure()

    // Push table snapshots (Data/*.json) + company.json
    onProgress?.('Uploading ledger…')
    const [company] = await db.companies.toArray()
    if (company) await drive.putJson('Company/company.json', company)
    await drive.putJson('Data/transactions.json', await db.transactions.toArray())
    await drive.putJson('Data/customers.json', await db.customers.toArray())
    await drive.putJson('Data/vendors.json', await db.vendors.toArray())
    await drive.putJson('Data/invoices.json', await db.invoices.toArray())
    await drive.putJson('Data/invoice_items.json', await db.invoice_items.toArray())
    await drive.putJson('Data/payments.json', await db.payments.toArray())
    await drive.putJson('Data/categories.json', await db.categories.toArray())

    // Append the pushed events to a rolling log
    onProgress?.('Recording change events…')
    const existingLog = (await drive.getJson<any[]>('Data/sync_events.json')) ?? []
    await drive.putJson('Data/sync_events.json', [...existingLog, ...pending].slice(-1000))

    // Mark events synced
    await db.transaction('rw', db.sync_events, async () => {
      for (const ev of pending) {
        await db.sync_events.update(ev.id, { sync_status: 'synced' })
      }
    })
    // Flip row-level sync_status to synced for touched rows
    await this.markRowsSynced()

    const at = new Date().toISOString()
    await this.setMetadata({
      connected: true,
      last_sync_at: at,
      sync_version: (await this.getMetadata()).sync_version + 1,
    })

    return { pushed: pending.length, pulled: 0, conflicts: this.getConflicts().length, at }
  },

  async markRowsSynced() {
    // Not every table indexes `sync_status`, so filter in JS rather than query.
    const tables = [db.transactions, db.invoices, db.payments, db.customers, db.vendors, db.documents]
    for (const table of tables) {
      try {
        const pending = await (table as any).filter((r: any) => r.sync_status === 'pending').toArray()
        for (const row of pending) {
          await (table as any).update(row.id, { sync_status: 'synced' })
        }
      } catch {
        /* skip table on error, non-critical */
      }
    }
  },

  async backupNow(): Promise<string> {
    const drive = getDrive()
    if (!drive.status().connected) throw new Error('Connect Google Drive first.')
    const pkg = await BackupService.build()
    await drive.ensureStructure()
    await drive.putJson('Backups/database-backup.json', pkg)
    const at = new Date().toISOString()
    await this.setMetadata({ last_sync_at: at })
    return at
  },

  async restoreFromDrive(): Promise<void> {
    const drive = getDrive()
    if (!drive.status().connected) throw new Error('Connect Google Drive first.')
    const pkg = await drive.getJson('Backups/database-backup.json')
    if (!pkg) throw new Error('No backup found in Drive yet.')
    await BackupService.restore(pkg as any)
  },

  // --- Conflict handling (last-write-wins with a review gate) -------------

  getConflicts(): SyncConflict[] {
    try {
      return JSON.parse(localStorage.getItem(CONFLICT_KEY) ?? '[]')
    } catch {
      return []
    }
  },

  saveConflicts(list: SyncConflict[]) {
    localStorage.setItem(CONFLICT_KEY, JSON.stringify(list))
  },

  /** Demonstration helper — fabricate a conflicting cloud edit for a txn. */
  async simulateConflict(): Promise<SyncConflict | null> {
    const txn = await db.transactions.filter((t) => !t.deleted_at && t.type !== 'transfer').first()
    if (!txn) return null
    const cloudRecord: Transaction = {
      ...txn,
      amount: Math.round(txn.amount * 1.15),
      updated_at: new Date(Date.now() + 60_000).toISOString(),
    }
    const conflict: SyncConflict = {
      id: `cf_${txn.id}`,
      entity_type: 'transaction',
      entity_id: txn.id,
      field: 'amount',
      local: String(txn.amount),
      cloud: String(cloudRecord.amount),
      localRecord: txn,
      cloudRecord,
    }
    const list = this.getConflicts().filter((c) => c.id !== conflict.id)
    list.push(conflict)
    this.saveConflicts(list)
    return conflict
  },

  async resolveConflict(id: string, choice: 'local' | 'cloud') {
    const list = this.getConflicts()
    const conflict = list.find((c) => c.id === id)
    if (!conflict) return
    if (choice === 'cloud' && conflict.entity_type === 'transaction') {
      const cloud = conflict.cloudRecord as Transaction
      await db.transactions.update(conflict.entity_id, {
        amount: cloud.amount,
        updated_at: cloud.updated_at,
        sync_status: 'synced',
      })
    } else {
      await db.transactions.update(conflict.entity_id, { sync_status: 'synced' })
    }
    this.saveConflicts(list.filter((c) => c.id !== id))
  },
}
