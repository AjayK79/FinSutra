import Dexie, { type Table } from 'dexie'
import type {
  Company,
  User,
  Customer,
  Vendor,
  EventRecord,
  Transaction,
  Invoice,
  InvoiceItem,
  Payment,
  DocumentRecord,
  Category,
  SyncEvent,
  SyncMetadata,
  AppNotification,
} from './types'

export class FinSutraDB extends Dexie {
  companies!: Table<Company, string>
  users!: Table<User, string>
  customers!: Table<Customer, string>
  vendors!: Table<Vendor, string>
  events!: Table<EventRecord, string>
  transactions!: Table<Transaction, string>
  invoices!: Table<Invoice, string>
  invoice_items!: Table<InvoiceItem, string>
  payments!: Table<Payment, string>
  documents!: Table<DocumentRecord, string>
  categories!: Table<Category, string>
  sync_events!: Table<SyncEvent, string>
  sync_metadata!: Table<SyncMetadata, string>
  notifications!: Table<AppNotification, string>

  constructor() {
    super('finsutra')
    this.version(1).stores({
      // Only index what we actually query on; blobs live inside the row.
      companies: 'id, name',
      users: 'id, company_id, email',
      customers: 'id, company_id, name, deleted_at',
      vendors: 'id, company_id, name, deleted_at',
      transactions:
        'id, company_id, type, date, category, customer_id, vendor_id, status, payment_method, deleted_at, sync_status',
      invoices:
        'id, company_id, invoice_number, customer_id, status, due_date, issue_date, deleted_at, sync_status',
      invoice_items: 'id, invoice_id',
      payments:
        'id, company_id, invoice_id, customer_id, vendor_id, direction, date, sync_status',
      documents:
        'id, company_id, category, linked_transaction_id, linked_invoice_id, linked_customer_id, linked_vendor_id, sync_status',
      categories: 'id, company_id, type',
      sync_events: 'id, entity_type, entity_id, timestamp, sync_status',
      sync_metadata: 'device_id',
      notifications: 'id, company_id, read, created_at, type',
    })

    // v2: events table + event_id index on transactions
    this.version(2).stores({
      events: 'id, company_id, customer_id, status, deleted_at',
      transactions:
        'id, company_id, type, date, category, customer_id, vendor_id, event_id, status, payment_method, deleted_at, sync_status',
    })
  }
}

export const db = new FinSutraDB()

/** Wipe every table (used by "Delete Local Data" and "Reset Demo"). */
export async function clearAllData() {
  await db.transaction(
    'rw',
    db.tables,
    async () => {
      await Promise.all(db.tables.map((t) => t.clear()))
    },
  )
}
