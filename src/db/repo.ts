import { db } from './database'
import { uid, deviceId } from '@/lib/id'
import { emitLocalChange } from '@/lib/changeBus'
import { computeInvoiceTotals, invoiceOutstanding, deriveInvoiceStatus } from '@/lib/calc'
import { todayISO } from '@/lib/format'
import type {
  Transaction,
  Customer,
  Vendor,
  EventRecord,
  Invoice,
  InvoiceItem,
  Payment,
  DocumentRecord,
  SyncEvent,
  SyncOperation,
  AppNotification,
  PaymentMethod,
} from './types'

function now() {
  return new Date().toISOString()
}

/** Record a sync event so the change can later be pushed to Drive. */
export async function logEvent(
  entity_type: string,
  entity_id: string,
  operation: SyncOperation,
  payload: unknown,
) {
  const ev: SyncEvent = {
    id: uid('evt'),
    entity_type,
    entity_id,
    operation,
    payload: JSON.stringify(payload),
    timestamp: now(),
    device_id: deviceId(),
    sync_status: 'pending',
  }
  await db.sync_events.add(ev)
  emitLocalChange()
}

// --- Company --------------------------------------------------------------

export function activeCompanyId(): string {
  return localStorage.getItem('finsutra_company_id') ?? ''
}
export function setActiveCompanyId(id: string) {
  localStorage.setItem('finsutra_company_id', id)
}

// --- Transactions ---------------------------------------------------------

export async function createTransaction(
  input: Omit<
    Transaction,
    | 'id'
    | 'created_at'
    | 'updated_at'
    | 'device_id'
    | 'sync_status'
    | 'currency'
    | 'attachment_ids'
  > & { currency?: string; attachment_ids?: string[]; id?: string },
): Promise<Transaction> {
  const txn: Transaction = {
    id: input.id ?? uid('txn'),
    company_id: input.company_id,
    type: input.type,
    amount: input.amount,
    currency: input.currency ?? 'INR',
    date: input.date,
    description: input.description,
    category: input.category,
    customer_id: input.customer_id ?? null,
    vendor_id: input.vendor_id ?? null,
    event_id: input.event_id ?? null,
    payment_method: input.payment_method,
    status: input.status ?? 'completed',
    reference_number: input.reference_number,
    notes: input.notes,
    attachment_ids: input.attachment_ids ?? [],
    transfer_to: input.transfer_to,
    payment_id: input.payment_id ?? null,
    created_by: input.created_by,
    created_at: now(),
    updated_at: now(),
    deleted_at: null,
    device_id: deviceId(),
    sync_status: 'pending',
  }
  await db.transactions.add(txn)
  await logEvent('transaction', txn.id, 'CREATE', txn)
  return txn
}

export async function updateTransaction(id: string, patch: Partial<Transaction>) {
  const updated_at = now()
  await db.transactions.update(id, { ...patch, updated_at, sync_status: 'pending' })
  const row = await db.transactions.get(id)
  if (row) await logEvent('transaction', id, 'UPDATE', row)
}

export async function softDeleteTransaction(id: string) {
  await db.transactions.update(id, {
    deleted_at: now(),
    updated_at: now(),
    sync_status: 'pending',
  })
  await logEvent('transaction', id, 'DELETE', { id })
}

// --- Customers ------------------------------------------------------------

export async function createCustomer(
  input: Partial<Customer> & { company_id: string; name: string },
): Promise<Customer> {
  const c: Customer = {
    id: input.id ?? uid('cus'),
    company_id: input.company_id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    gstin: input.gstin,
    notes: input.notes,
    created_at: now(),
    updated_at: now(),
    deleted_at: null,
    sync_status: 'pending',
  }
  await db.customers.add(c)
  await logEvent('customer', c.id, 'CREATE', c)
  return c
}

export async function updateCustomer(id: string, patch: Partial<Customer>) {
  await db.customers.update(id, { ...patch, updated_at: now(), sync_status: 'pending' })
  const row = await db.customers.get(id)
  if (row) await logEvent('customer', id, 'UPDATE', row)
}

export async function deleteCustomer(id: string) {
  await db.customers.update(id, { deleted_at: now(), updated_at: now(), sync_status: 'pending' })
  await logEvent('customer', id, 'DELETE', { id })
}

// --- Events ---------------------------------------------------------------

export async function createEvent(
  input: Partial<EventRecord> & { company_id: string; name: string },
): Promise<EventRecord> {
  const ev: EventRecord = {
    id: input.id ?? uid('evt_e'),
    company_id: input.company_id,
    name: input.name,
    customer_id: input.customer_id ?? null,
    event_date: input.event_date,
    expected_amount: input.expected_amount,
    status: input.status ?? 'active',
    notes: input.notes,
    created_at: now(),
    updated_at: now(),
    deleted_at: null,
    sync_status: 'pending',
  }
  await db.events.add(ev)
  await logEvent('event', ev.id, 'CREATE', ev)
  return ev
}

export async function updateEvent(id: string, patch: Partial<EventRecord>) {
  await db.events.update(id, { ...patch, updated_at: now(), sync_status: 'pending' })
  const row = await db.events.get(id)
  if (row) await logEvent('event', id, 'UPDATE', row)
}

export async function deleteEvent(id: string) {
  await db.events.update(id, { deleted_at: now(), updated_at: now(), sync_status: 'pending' })
  await logEvent('event', id, 'DELETE', { id })
}

// --- Vendors --------------------------------------------------------------

export async function createVendor(
  input: Partial<Vendor> & { company_id: string; name: string },
): Promise<Vendor> {
  const v: Vendor = {
    id: input.id ?? uid('ven'),
    company_id: input.company_id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    gstin: input.gstin,
    notes: input.notes,
    created_at: now(),
    updated_at: now(),
    deleted_at: null,
    sync_status: 'pending',
  }
  await db.vendors.add(v)
  await logEvent('vendor', v.id, 'CREATE', v)
  return v
}

export async function updateVendor(id: string, patch: Partial<Vendor>) {
  await db.vendors.update(id, { ...patch, updated_at: now(), sync_status: 'pending' })
  const row = await db.vendors.get(id)
  if (row) await logEvent('vendor', id, 'UPDATE', row)
}

export async function deleteVendor(id: string) {
  await db.vendors.update(id, { deleted_at: now(), updated_at: now(), sync_status: 'pending' })
  await logEvent('vendor', id, 'DELETE', { id })
}

// --- Invoices -------------------------------------------------------------

export interface InvoiceItemInput {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  discount: number
}

export async function nextInvoiceNumber(company_id: string): Promise<string> {
  const invoices = await db.invoices.where('company_id').equals(company_id).toArray()
  let max = 0
  for (const inv of invoices) {
    const m = inv.invoice_number.match(/(\d+)\s*$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const n = (max + 1).toString().padStart(5, '0')
  return `INV-${n}`
}

export async function createInvoice(
  input: {
    company_id: string
    invoice_number: string
    customer_id: string
    issue_date: string
    due_date: string
    notes?: string
    payment_instructions?: string
    status?: 'draft' | 'sent'
    id?: string
  },
  items: InvoiceItemInput[],
): Promise<Invoice> {
  const invoiceId = input.id ?? uid('inv')
  const itemRows: InvoiceItem[] = items.map((it) => ({
    id: uid('itm'),
    invoice_id: invoiceId,
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    tax_rate: it.tax_rate,
    discount: it.discount,
    line_total: Math.round(it.quantity * it.unit_price * (1 - it.discount / 100) * 100) / 100,
  }))
  const totals = computeInvoiceTotals(itemRows)
  const inv: Invoice = {
    id: invoiceId,
    company_id: input.company_id,
    invoice_number: input.invoice_number,
    customer_id: input.customer_id,
    issue_date: input.issue_date,
    due_date: input.due_date,
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: totals.discount,
    total: totals.total,
    paid_amount: 0,
    outstanding_amount: totals.total,
    status: input.status ?? 'sent',
    notes: input.notes,
    payment_instructions: input.payment_instructions,
    attachment_ids: [],
    created_at: now(),
    updated_at: now(),
    deleted_at: null,
    device_id: deviceId(),
    sync_status: 'pending',
  }
  await db.transaction('rw', db.invoices, db.invoice_items, db.sync_events, async () => {
    await db.invoices.add(inv)
    await db.invoice_items.bulkAdd(itemRows)
    await logEvent('invoice', inv.id, 'CREATE', { invoice: inv, items: itemRows })
  })
  return inv
}

export async function updateInvoice(
  id: string,
  input: {
    customer_id?: string
    invoice_number?: string
    issue_date?: string
    due_date?: string
    notes?: string
    payment_instructions?: string
    status?: Invoice['status']
  },
  items?: InvoiceItemInput[],
) {
  const existing = await db.invoices.get(id)
  if (!existing) throw new Error('Invoice not found')
  let totals = {
    subtotal: existing.subtotal,
    tax: existing.tax,
    discount: existing.discount,
    total: existing.total,
  }
  await db.transaction('rw', db.invoices, db.invoice_items, db.sync_events, async () => {
    if (items) {
      await db.invoice_items.where('invoice_id').equals(id).delete()
      const itemRows: InvoiceItem[] = items.map((it) => ({
        id: uid('itm'),
        invoice_id: id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        tax_rate: it.tax_rate,
        discount: it.discount,
        line_total: Math.round(it.quantity * it.unit_price * (1 - it.discount / 100) * 100) / 100,
      }))
      await db.invoice_items.bulkAdd(itemRows)
      totals = computeInvoiceTotals(itemRows)
    }
    const paid = existing.paid_amount
    const patch: Partial<Invoice> = {
      ...input,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      outstanding_amount: Math.max(0, totals.total - paid),
      updated_at: now(),
      sync_status: 'pending',
    }
    // recompute status unless explicitly set to draft/sent
    if (!input.status) {
      patch.status = deriveInvoiceStatus({ ...existing, ...patch, total: totals.total, paid_amount: paid })
    }
    await db.invoices.update(id, patch)
    const row = await db.invoices.get(id)
    if (row) await logEvent('invoice', id, 'UPDATE', row)
  })
}

export async function setInvoiceStatus(id: string, status: Invoice['status']) {
  await db.invoices.update(id, { status, updated_at: now(), sync_status: 'pending' })
  const row = await db.invoices.get(id)
  if (row) await logEvent('invoice', id, 'UPDATE', row)
}

export async function softDeleteInvoice(id: string) {
  await db.invoices.update(id, { deleted_at: now(), updated_at: now(), sync_status: 'pending' })
  await logEvent('invoice', id, 'DELETE', { id })
}

/** Recompute an invoice's paid/outstanding/status from its payments. */
export async function recomputeInvoice(invoiceId: string) {
  const inv = await db.invoices.get(invoiceId)
  if (!inv) return
  const payments = await db.payments.where('invoice_id').equals(invoiceId).toArray()
  const paid = payments
    .filter((p) => p.direction === 'in')
    .reduce((acc, p) => acc + p.amount, 0)
  const paidRounded = Math.round(paid * 100) / 100
  const outstanding = invoiceOutstanding({ total: inv.total, paid_amount: paidRounded })
  const status = deriveInvoiceStatus({
    total: inv.total,
    paid_amount: paidRounded,
    due_date: inv.due_date,
    status: inv.status === 'draft' ? 'sent' : inv.status,
  })
  await db.invoices.update(invoiceId, {
    paid_amount: paidRounded,
    outstanding_amount: outstanding,
    status,
    updated_at: now(),
    sync_status: 'pending',
  })
  const row = await db.invoices.get(invoiceId)
  if (row) await logEvent('invoice', invoiceId, 'UPDATE', row)
}

// --- Payments -------------------------------------------------------------

/**
 * Record a payment. Creates a Payment row, an associated cash Transaction,
 * and (if against an invoice) recomputes the invoice balance.
 */
export async function recordPayment(input: {
  company_id: string
  invoice_id?: string | null
  customer_id?: string | null
  vendor_id?: string | null
  amount: number
  date: string
  payment_method: PaymentMethod
  reference_number?: string
  notes?: string
  direction: 'in' | 'out'
  attachment_ids?: string[]
  category?: string
}): Promise<Payment> {
  const payment: Payment = {
    id: uid('pay'),
    company_id: input.company_id,
    invoice_id: input.invoice_id ?? null,
    customer_id: input.customer_id ?? null,
    vendor_id: input.vendor_id ?? null,
    amount: input.amount,
    date: input.date,
    payment_method: input.payment_method,
    reference_number: input.reference_number,
    notes: input.notes,
    direction: input.direction,
    attachment_ids: input.attachment_ids ?? [],
    created_at: now(),
    updated_at: now(),
    device_id: deviceId(),
    sync_status: 'pending',
  }
  await db.payments.add(payment)
  await logEvent('payment', payment.id, 'CREATE', payment)

  // Mirror as a cash transaction so the ledger/dashboard reflects the money.
  await createTransaction({
    company_id: input.company_id,
    type: input.direction === 'in' ? 'income' : 'expense',
    amount: input.amount,
    date: input.date,
    description:
      input.notes ||
      (input.invoice_id ? `Payment against invoice` : 'Payment'),
    category: input.category ?? (input.direction === 'in' ? 'Sales' : 'Payments'),
    customer_id: input.customer_id ?? null,
    vendor_id: input.vendor_id ?? null,
    payment_method: input.payment_method,
    status: 'completed',
    reference_number: input.reference_number,
    attachment_ids: input.attachment_ids ?? [],
    payment_id: payment.id,
  })

  if (input.invoice_id) {
    await recomputeInvoice(input.invoice_id)
  }
  return payment
}

// --- Documents ------------------------------------------------------------

export async function createDocument(
  input: Omit<DocumentRecord, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & {
    id?: string
  },
): Promise<DocumentRecord> {
  const doc: DocumentRecord = {
    ...input,
    id: input.id ?? uid('doc'),
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
  }
  await db.documents.add(doc)
  // event payload excludes the blob (too big) — blobs sync as file uploads.
  const { blob, ...meta } = doc
  await logEvent('document', doc.id, 'CREATE', meta)
  return doc
}

export async function deleteDocument(id: string) {
  await db.documents.delete(id)
  await logEvent('document', id, 'DELETE', { id })
}

// --- Notifications --------------------------------------------------------

export async function pushNotification(
  n: Omit<AppNotification, 'id' | 'created_at' | 'read'> & { read?: boolean },
) {
  const notif: AppNotification = {
    ...n,
    id: uid('ntf'),
    read: n.read ?? false,
    created_at: now(),
  }
  await db.notifications.add(notif)
  return notif
}

export async function markNotificationRead(id: string) {
  await db.notifications.update(id, { read: true })
}

export async function markAllNotificationsRead(company_id: string) {
  const all = await db.notifications.where('company_id').equals(company_id).toArray()
  await Promise.all(all.map((n) => db.notifications.update(n.id, { read: true })))
}

export { todayISO }
