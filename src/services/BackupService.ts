// ---------------------------------------------------------------------------
// BackupService — serialise the entire local ledger into a portable package
// and restore it. Works fully offline. Document blobs are embedded as base64
// so attachments survive a round-trip.
// ---------------------------------------------------------------------------

import { db, clearAllData } from '@/db/database'
import type { DocumentRecord } from '@/db/types'

export interface BackupPackage {
  app: 'FinSutra'
  version: number
  created_at: string
  device_id?: string
  data: {
    companies: unknown[]
    users: unknown[]
    customers: unknown[]
    vendors: unknown[]
    transactions: unknown[]
    invoices: unknown[]
    invoice_items: unknown[]
    payments: unknown[]
    categories: unknown[]
    notifications: unknown[]
    documents: (Omit<DocumentRecord, 'blob'> & { blob_base64?: string })[]
    sync_metadata: unknown[]
  }
}

export interface BackupСounts {
  transactions: number
  invoices: number
  customers: number
  vendors: number
  payments: number
  documents: number
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mime: string): Blob {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export const BackupService = {
  async build(): Promise<BackupPackage> {
    const [
      companies,
      users,
      customers,
      vendors,
      transactions,
      invoices,
      invoice_items,
      payments,
      categories,
      notifications,
      documentsRaw,
      sync_metadata,
    ] = await Promise.all([
      db.companies.toArray(),
      db.users.toArray(),
      db.customers.toArray(),
      db.vendors.toArray(),
      db.transactions.toArray(),
      db.invoices.toArray(),
      db.invoice_items.toArray(),
      db.payments.toArray(),
      db.categories.toArray(),
      db.notifications.toArray(),
      db.documents.toArray(),
      db.sync_metadata.toArray(),
    ])

    const documents = await Promise.all(
      documentsRaw.map(async (d) => {
        const { blob, ...rest } = d
        return {
          ...rest,
          blob_base64: blob ? await blobToBase64(blob) : undefined,
        }
      }),
    )

    return {
      app: 'FinSutra',
      version: 1,
      created_at: new Date().toISOString(),
      data: {
        companies,
        users,
        customers,
        vendors,
        transactions,
        invoices,
        invoice_items,
        payments,
        categories,
        notifications,
        documents,
        sync_metadata,
      },
    }
  },

  countsOf(pkg: BackupPackage): BackupСounts {
    const d = pkg.data
    return {
      transactions: d.transactions?.length ?? 0,
      invoices: d.invoices?.length ?? 0,
      customers: d.customers?.length ?? 0,
      vendors: d.vendors?.length ?? 0,
      payments: d.payments?.length ?? 0,
      documents: d.documents?.length ?? 0,
    }
  },

  validate(raw: unknown): BackupPackage {
    if (!raw || typeof raw !== 'object') throw new Error('This file is empty or not readable.')
    const pkg = raw as BackupPackage
    if (pkg.app !== 'FinSutra' || !pkg.data) {
      throw new Error('This does not look like a FinSutra backup file.')
    }
    if (!Array.isArray(pkg.data.transactions) || !Array.isArray(pkg.data.invoices)) {
      throw new Error('The backup file is corrupted or incomplete.')
    }
    return pkg
  },

  async restore(pkg: BackupPackage): Promise<void> {
    const valid = this.validate(pkg)
    await clearAllData()
    const d = valid.data
    const documents = (d.documents ?? []).map((doc) => {
      const { blob_base64, ...rest } = doc as any
      return {
        ...rest,
        blob: blob_base64 ? base64ToBlob(blob_base64, rest.mime_type || 'application/octet-stream') : undefined,
      }
    })
    await db.transaction('rw', db.tables, async () => {
      await db.companies.bulkPut(d.companies as any)
      await db.users.bulkPut(d.users as any)
      await db.customers.bulkPut(d.customers as any)
      await db.vendors.bulkPut(d.vendors as any)
      await db.transactions.bulkPut(d.transactions as any)
      await db.invoices.bulkPut(d.invoices as any)
      await db.invoice_items.bulkPut(d.invoice_items as any)
      await db.payments.bulkPut(d.payments as any)
      await db.categories.bulkPut(d.categories as any)
      await db.notifications.bulkPut((d.notifications ?? []) as any)
      await db.documents.bulkPut(documents as any)
      await db.sync_metadata.bulkPut((d.sync_metadata ?? []) as any)
    })
    // restore active company pointer
    const first = (d.companies as any[])?.[0]
    if (first?.id) localStorage.setItem('finsutra_company_id', first.id)
  },

  download(pkg: BackupPackage, filename?: string) {
    const name = filename ?? `finsutra-backup-${new Date().toISOString().slice(0, 10)}.json`
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
    triggerDownload(blob, name)
  },
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
