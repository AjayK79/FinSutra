// ---------------------------------------------------------------------------
// SyncEngine — keeps the local DB and the Drive folder in step so the app
// "remembers" across devices:
//   • on login: pull the snapshot from Drive and restore/merge it locally
//   • on every change: debounced push of the snapshot (+ the readable Sheet)
//   • on reconnect / app refocus: a full pull + push
// The local DB stays the working copy; Drive is the shared source of truth.
// Demo data is never pushed to the real folder.
// ---------------------------------------------------------------------------

import { db } from '@/db/database'
import { GoogleAuth } from './auth'
import { getJsonFile, putJsonFile } from './drive'
import {
  buildSnapshot, mergeIntoLocal, replaceLocalWith, snapshotCompanyId, snapshotHasData, type Snapshot,
} from './snapshot'
import { LedgerSync } from './ledger'
import { getDriveFolderId } from '@/config'
import { setActiveCompanyId } from '@/db/repo'
import { onLocalChange } from '@/lib/changeBus'
import type { Transaction } from '@/db/types'

const SNAPSHOT_NAME = 'finsutra-data.json'
const LAST_SYNC_KEY = 'finsutra_ledger_last_sync'

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled'

interface Status {
  state: SyncState
  lastSync: string
  error: string
}

let status: Status = {
  state: 'idle',
  lastSync: (() => { try { return localStorage.getItem(LAST_SYNC_KEY) || '' } catch { return '' } })(),
  error: '',
}

const listeners = new Set<() => void>()
function setStatus(patch: Partial<Status>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
function isDemoActive() {
  try { return localStorage.getItem('finsutra_demo') === 'true' } catch { return false }
}
function ready() {
  return GoogleAuth.isConfigured() && GoogleAuth.hasSession()
}

async function resolveAttachments(t: Transaction) {
  let doc = await db.documents.where('linked_transaction_id').equals(t.id).first()
  if (!doc?.blob && t.attachment_ids?.[0]) doc = await db.documents.get(t.attachment_ids[0])
  if (!doc?.blob) return null
  return { blob: doc.blob, filename: doc.filename }
}

// serialise operations so pulls/pushes never overlap
let chain: Promise<unknown> = Promise.resolve()
function queue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.catch(() => {})
  return run
}

async function pullInternal(): Promise<'restored' | 'merged' | 'seeded' | 'none'> {
  const folder = getDriveFolderId()
  const cloud = await getJsonFile<Snapshot>(SNAPSHOT_NAME, folder)
  const localCompany = await db.companies.toCollection().first()

  if (snapshotHasData(cloud)) {
    const cloudId = snapshotCompanyId(cloud)
    if (!localCompany || localCompany.id !== cloudId) {
      // new device, or leftover demo/other business → take the cloud copy
      await replaceLocalWith(cloud!)
      setActiveCompanyId(cloudId)
      try { localStorage.removeItem('finsutra_demo') } catch { /* ignore */ }
      return 'restored'
    }
    await mergeIntoLocal(cloud!)
    return 'merged'
  }
  // cloud empty → seed it from a real (non-demo) local business
  if (localCompany && !isDemoActive()) return 'seeded'
  return 'none'
}

async function pushInternal() {
  if (isDemoActive()) return // never push demo data to the real folder
  const folder = getDriveFolderId()
  const snapshot = await buildSnapshot()
  await putJsonFile(SNAPSHOT_NAME, snapshot, folder)

  const [customers, vendors, events, transactions] = await Promise.all([
    db.customers.toArray(),
    db.vendors.toArray(),
    db.events.toArray(),
    db.transactions.toArray(),
  ])
  await LedgerSync.pushAll(
    transactions,
    { customers, vendors, events, enteredBy: GoogleAuth.currentEmail() || 'FlaminQo' },
    resolveAttachments,
  )
}

function stamp() {
  const now = new Date().toISOString()
  try { localStorage.setItem(LAST_SYNC_KEY, now) } catch { /* ignore */ }
  setStatus({ state: 'idle', lastSync: now, error: '' })
}

export const SyncEngine = {
  getStatus(): Status {
    return status
  },
  subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },

  /** Called once after sign-in: pull the cloud copy so the app remembers. */
  async restoreOnLogin(): Promise<void> {
    if (!ready()) return
    if (!isOnline()) { setStatus({ state: 'offline' }); return }
    return queue(async () => {
      try {
        setStatus({ state: 'syncing' })
        const outcome = await pullInternal()
        if (outcome === 'merged' || outcome === 'seeded') await pushInternal()
        stamp()
      } catch (e: any) {
        setStatus({ state: isOnline() ? 'error' : 'offline', error: e?.message ?? 'Sync failed' })
      }
    })
  },

  /** Full sync: pull + merge + push. */
  async syncNow(): Promise<void> {
    if (!ready()) return
    if (!isOnline()) { setStatus({ state: 'offline' }); return }
    return queue(async () => {
      try {
        setStatus({ state: 'syncing' })
        await pullInternal()
        await pushInternal()
        stamp()
      } catch (e: any) {
        setStatus({ state: isOnline() ? 'error' : 'offline', error: e?.message ?? 'Sync failed' })
      }
    })
  },

  /** Push local changes up (used by the debounced change trigger). */
  async pushNow(): Promise<void> {
    if (!ready() || !isOnline()) return
    return queue(async () => {
      try {
        setStatus({ state: 'syncing' })
        await pushInternal()
        stamp()
      } catch (e: any) {
        setStatus({ state: isOnline() ? 'error' : 'offline', error: e?.message ?? 'Sync failed' })
      }
    })
  },

  _timer: undefined as ReturnType<typeof setTimeout> | undefined,
  scheduleSync() {
    if (!ready()) return
    if (this._timer) clearTimeout(this._timer)
    this._timer = setTimeout(() => this.pushNow(), 4000)
  },

  _started: false,
  start() {
    if (this._started) return
    this._started = true
    onLocalChange(() => this.scheduleSync())
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncNow())
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.syncNow()
      })
    }
  },
}
