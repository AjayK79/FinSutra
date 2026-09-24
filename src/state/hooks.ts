import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { activeCompanyId } from '@/db/repo'

export function useActiveCompanyId(): string {
  const id = useLiveQuery(async () => {
    const stored = activeCompanyId()
    if (stored) {
      const exists = await db.companies.get(stored)
      if (exists) return stored
    }
    const first = await db.companies.toCollection().first()
    return first?.id ?? ''
  }, [], activeCompanyId())
  return id ?? ''
}

export function useCompany() {
  const cid = useActiveCompanyId()
  return useLiveQuery(async () => {
    if (!cid) return undefined
    return db.companies.get(cid)
  }, [cid])
}

export function useCustomers() {
  const cid = useActiveCompanyId()
  return (
    useLiveQuery(async () => {
      if (!cid) return []
      const rows = await db.customers.where('company_id').equals(cid).toArray()
      return rows.filter((c) => !c.deleted_at).sort((a, b) => a.name.localeCompare(b.name))
    }, [cid]) ?? []
  )
}

export function useVendors() {
  const cid = useActiveCompanyId()
  return (
    useLiveQuery(async () => {
      if (!cid) return []
      const rows = await db.vendors.where('company_id').equals(cid).toArray()
      return rows.filter((v) => !v.deleted_at).sort((a, b) => a.name.localeCompare(b.name))
    }, [cid]) ?? []
  )
}

export function useTransactions() {
  const cid = useActiveCompanyId()
  return (
    useLiveQuery(async () => {
      if (!cid) return []
      const rows = await db.transactions.where('company_id').equals(cid).toArray()
      return rows.filter((t) => !t.deleted_at).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.created_at.localeCompare(a.created_at)))
    }, [cid]) ?? []
  )
}

export function useInvoices() {
  const cid = useActiveCompanyId()
  return (
    useLiveQuery(async () => {
      if (!cid) return []
      const rows = await db.invoices.where('company_id').equals(cid).toArray()
      return rows.filter((i) => !i.deleted_at).sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1))
    }, [cid]) ?? []
  )
}

export function useInvoice(id?: string) {
  return useLiveQuery(async () => {
    if (!id) return undefined
    return db.invoices.get(id)
  }, [id])
}

export function useInvoiceItems(invoiceId?: string) {
  return (
    useLiveQuery(async () => {
      if (!invoiceId) return []
      return db.invoice_items.where('invoice_id').equals(invoiceId).toArray()
    }, [invoiceId]) ?? []
  )
}

export function usePayments() {
  const cid = useActiveCompanyId()
  return (
    useLiveQuery(async () => {
      if (!cid) return []
      return db.payments.where('company_id').equals(cid).toArray()
    }, [cid]) ?? []
  )
}

export function useDocuments() {
  const cid = useActiveCompanyId()
  return (
    useLiveQuery(async () => {
      if (!cid) return []
      const rows = await db.documents.where('company_id').equals(cid).toArray()
      return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    }, [cid]) ?? []
  )
}

export function useCategories() {
  const cid = useActiveCompanyId()
  return (
    useLiveQuery(async () => {
      if (!cid) return []
      return db.categories.where('company_id').equals(cid).toArray()
    }, [cid]) ?? []
  )
}

export function useNotifications() {
  const cid = useActiveCompanyId()
  return (
    useLiveQuery(async () => {
      if (!cid) return []
      const rows = await db.notifications.where('company_id').equals(cid).toArray()
      return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    }, [cid]) ?? []
  )
}

export function usePendingSyncCount() {
  return (
    useLiveQuery(async () => {
      return db.sync_events.where('sync_status').equals('pending').count()
    }, []) ?? 0
  )
}

export function useSyncMetadata() {
  return useLiveQuery(async () => {
    return db.sync_metadata.toCollection().first()
  }, [])
}
