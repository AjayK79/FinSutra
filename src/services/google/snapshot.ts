// ---------------------------------------------------------------------------
// Snapshot — a full picture of the local business (company, parties, ledger)
// stored as one JSON file in the Drive folder. This is what makes the app
// "remember" across devices: on login we pull it and restore/merge locally.
// Evidence image bytes are NOT in here (they live in the Drive monthly folders);
// local blobs are preserved on merge.
// ---------------------------------------------------------------------------

import { db } from '@/db/database'

const TABLES = [
  'companies', 'users', 'customers', 'vendors', 'events', 'transactions',
  'invoices', 'invoice_items', 'payments', 'categories', 'documents',
] as const

export interface Snapshot {
  app: 'FinSutra'
  kind: 'snapshot'
  version: number
  updated_at: string
  data: Record<string, any[]>
}

function when(r: any): string {
  return r?.updated_at || r?.created_at || ''
}

export async function buildSnapshot(): Promise<Snapshot> {
  const data: Record<string, any[]> = {}
  for (const t of TABLES) {
    data[t] = await (db as any)[t].toArray()
  }
  // Strip blobs from documents — the images live in Drive, not the JSON.
  data.documents = (data.documents || []).map(({ blob, ...rest }: any) => rest)

  let max = ''
  for (const t of TABLES) for (const r of data[t] || []) { const w = when(r); if (w > max) max = w }

  return { app: 'FinSutra', kind: 'snapshot', version: 1, updated_at: max, data }
}

export function snapshotCompanyId(s: Snapshot | null): string {
  return s?.data?.companies?.[0]?.id ?? ''
}

export function snapshotHasData(s: Snapshot | null): boolean {
  return !!s && (s.data?.companies?.length ?? 0) > 0
}

function mergeById(local: any[], cloud: any[], useTime: boolean): any[] {
  const map = new Map<string, any>()
  for (const r of local) map.set(r.id, r)
  for (const r of cloud) {
    const ex = map.get(r.id)
    if (!ex) map.set(r.id, r)
    else if (!useTime) map.set(r.id, r) // prefer cloud
    else if (when(r) > when(ex)) map.set(r.id, r)
  }
  return [...map.values()]
}

/** Merge a cloud snapshot into local data (record-level last-write-wins). */
export async function mergeIntoLocal(cloud: Snapshot): Promise<void> {
  const localDocs = await db.documents.toArray() // keep local blobs
  const blobById = new Map(localDocs.map((d) => [d.id, d.blob]))

  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) {
      const local = await (db as any)[t].toArray()
      const useTime = t !== 'invoice_items'
      let merged = mergeById(local, cloud.data[t] || [], useTime)
      if (t === 'documents') {
        merged = merged.map((d: any) => ({ ...d, blob: blobById.get(d.id) ?? d.blob }))
      }
      await (db as any)[t].bulkPut(merged)
    }
  })
}

/** Replace all local data with a cloud snapshot (used when switching business). */
export async function replaceLocalWith(cloud: Snapshot): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) {
      await (db as any)[t].clear()
      const rows = cloud.data[t] || []
      if (rows.length) await (db as any)[t].bulkPut(rows)
    }
  })
}
