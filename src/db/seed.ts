// ---------------------------------------------------------------------------
// Demo seed — realistic Indian SMB data (TalentRayz Technologies) that shows
// every dashboard state: paid / partially-paid / outstanding / overdue
// invoices, receivables aging, payables, six months of cash flow, and a
// spread of categories. Seeded rows are marked "synced" so only the user's
// own actions populate the sync queue.
// ---------------------------------------------------------------------------

import { db, clearAllData } from './database'
import { uid, deviceId } from '@/lib/id'
import { computeInvoiceTotals, deriveInvoiceStatus, invoiceOutstanding } from '@/lib/calc'
import { setActiveCompanyId } from './repo'
import { format, subDays, subMonths } from 'date-fns'
import type {
  Company,
  Customer,
  Vendor,
  EventRecord,
  Transaction,
  Invoice,
  InvoiceItem,
  Payment,
  Category,
  PaymentMethod,
  TransactionType,
} from './types'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const nowISO = () => new Date().toISOString()
const DEV = deviceId()

export const DEMO_COMPANY_ID = 'company_demo_talentrayz'

function mkTxn(p: {
  type: TransactionType
  amount: number
  date: Date
  description: string
  category: string
  customer_id?: string
  vendor_id?: string
  event_id?: string
  payment_method?: PaymentMethod
  status?: 'completed' | 'pending'
}): Transaction {
  return {
    id: uid('txn'),
    company_id: DEMO_COMPANY_ID,
    type: p.type,
    amount: p.amount,
    currency: 'INR',
    date: iso(p.date),
    description: p.description,
    category: p.category,
    customer_id: p.customer_id ?? null,
    vendor_id: p.vendor_id ?? null,
    event_id: p.event_id ?? null,
    payment_method: p.payment_method ?? 'Bank',
    status: p.status ?? 'completed',
    reference_number: '',
    notes: '',
    attachment_ids: [],
    payment_id: null,
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted_at: null,
    device_id: DEV,
    sync_status: 'synced',
  }
}

export async function seedDemoData() {
  await clearAllData()
  const today = new Date()

  // --- Company ------------------------------------------------------------
  const company: Company = {
    id: DEMO_COMPANY_ID,
    name: 'TalentRayz Technologies Pvt. Ltd.',
    owner_name: 'Ajay',
    email: 'ajay@talentrayz.com',
    phone: '+91 98200 12345',
    currency: 'INR',
    financial_year: 'Apr 2026 - Mar 2027',
    business_type: 'Agency',
    gstin: '27ABCDE1234F1Z5',
    address: '4th Floor, Prestige Tech Park, Bengaluru 560103',
    data_mode: 'local',
    created_at: nowISO(),
    updated_at: nowISO(),
  }

  // --- Customers ----------------------------------------------------------
  const custDefs = [
    { name: 'ABC Technologies', email: 'accounts@abctech.com', phone: '+91 98111 22233', gstin: '29ABCTE1111A1Z2' },
    { name: 'XYZ Corp', email: 'finance@xyzcorp.com', phone: '+91 99000 44556', gstin: '27XYZCO2222B1Z3' },
    { name: 'Tenneo', email: 'billing@tenneo.com', phone: '+91 90000 77889', gstin: '06TENNE3333C1Z4' },
    { name: 'Acme Consulting', email: 'ap@acmeconsulting.in', phone: '+91 98765 43210', gstin: '24ACMEC4444D1Z5' },
    { name: 'Global Learning Solutions', email: 'pay@globallearning.com', phone: '+91 91234 56780', gstin: '19GLOBA5555E1Z6' },
  ]
  const customers: Customer[] = custDefs.map((c) => ({
    id: uid('cus'),
    company_id: DEMO_COMPANY_ID,
    name: c.name,
    email: c.email,
    phone: c.phone,
    gstin: c.gstin,
    address: 'India',
    notes: '',
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted_at: null,
    sync_status: 'synced',
  }))
  const C = Object.fromEntries(customers.map((c) => [c.name, c.id])) as Record<string, string>

  // --- Vendors ------------------------------------------------------------
  const venDefs = [
    { name: 'Google Cloud', email: 'billing@google.com' },
    { name: 'AWS', email: 'aws-billing@amazon.com' },
    { name: 'ABC Printers', email: 'sales@abcprinters.in' },
    { name: 'Office Rent', email: 'landlord@prestige.in' },
    { name: 'Zoho', email: 'billing@zoho.com' },
  ]
  const vendors: Vendor[] = venDefs.map((v) => ({
    id: uid('ven'),
    company_id: DEMO_COMPANY_ID,
    name: v.name,
    email: v.email,
    phone: '',
    gstin: '',
    address: '',
    notes: '',
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted_at: null,
    sync_status: 'synced',
  }))
  const V = Object.fromEntries(vendors.map((v) => [v.name, v.id])) as Record<string, string>

  // --- Events -------------------------------------------------------------
  const eventDefs = [
    { name: 'ABC Product Launch', customer: 'ABC Technologies', daysAgo: 20, expected: 500000, status: 'active' as const },
    { name: 'XYZ Annual Offsite', customer: 'XYZ Corp', daysAgo: 45, expected: 300000, status: 'completed' as const },
  ]
  const events: EventRecord[] = eventDefs.map((e) => ({
    id: uid('evt_e'),
    company_id: DEMO_COMPANY_ID,
    name: e.name,
    customer_id: C[e.customer],
    event_date: iso(subDays(today, e.daysAgo)),
    expected_amount: e.expected,
    status: e.status,
    notes: '',
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted_at: null,
    sync_status: 'synced',
  }))
  const E = Object.fromEntries(events.map((e) => [e.name, e.id])) as Record<string, string>

  // --- Transactions: 6 months of income + expenses ------------------------
  const transactions: Transaction[] = []

  // Recurring monthly expenses across the last 6 months
  for (let m = 5; m >= 0; m--) {
    const base = subMonths(today, m)
    transactions.push(
      mkTxn({ type: 'expense', amount: 120000, date: new Date(base.getFullYear(), base.getMonth(), 3), description: 'Office rent', category: 'Rent', vendor_id: V['Office Rent'], payment_method: 'Bank' }),
      mkTxn({ type: 'expense', amount: 85000 + m * 1500, date: new Date(base.getFullYear(), base.getMonth(), 5), description: 'AWS cloud hosting', category: 'Software', vendor_id: V['AWS'], payment_method: 'Card' }),
      mkTxn({ type: 'expense', amount: 32000, date: new Date(base.getFullYear(), base.getMonth(), 6), description: 'Google Cloud services', category: 'Software', vendor_id: V['Google Cloud'], payment_method: 'Card' }),
      mkTxn({ type: 'expense', amount: 27000, date: new Date(base.getFullYear(), base.getMonth(), 8), description: 'Zoho subscription', category: 'Software', vendor_id: V['Zoho'], payment_method: 'Card' }),
      mkTxn({ type: 'expense', amount: 480000 + m * 8000, date: new Date(base.getFullYear(), base.getMonth(), 1), description: 'Team salaries', category: 'Salaries', payment_method: 'Bank' }),
    )
  }
  // A few one-off expenses
  transactions.push(
    mkTxn({ type: 'expense', amount: 42000, date: subDays(today, 8), description: 'Brochures & print collateral', category: 'Marketing', vendor_id: V['ABC Printers'], payment_method: 'UPI', event_id: E['ABC Product Launch'] }),
    mkTxn({ type: 'expense', amount: 35000, date: subDays(today, 15), description: 'Client visit travel', category: 'Travel', payment_method: 'Card', event_id: E['XYZ Annual Offsite'] }),
    mkTxn({ type: 'expense', amount: 18500, date: subDays(today, 3), description: 'Event brochures', category: 'Marketing', vendor_id: V['ABC Printers'], payment_method: 'UPI', event_id: E['ABC Product Launch'] }),
    // Event income
    mkTxn({ type: 'income', amount: 250000, date: subDays(today, 10), description: 'ABC Product Launch — advance', category: 'Services', customer_id: C['ABC Technologies'], payment_method: 'Bank', event_id: E['ABC Product Launch'] }),
    mkTxn({ type: 'income', amount: 300000, date: subDays(today, 40), description: 'XYZ Offsite — final payment', category: 'Services', customer_id: C['XYZ Corp'], payment_method: 'Bank', event_id: E['XYZ Annual Offsite'] }),
    // Payables (pending expenses)
    mkTxn({ type: 'expense', amount: 96000, date: subDays(today, -5), description: 'Q3 cloud reserved instances (due)', category: 'Software', vendor_id: V['AWS'], status: 'pending', payment_method: 'Bank' }),
    mkTxn({ type: 'expense', amount: 54000, date: subDays(today, 2), description: 'Design contractor invoice (due)', category: 'Contractors', status: 'pending', payment_method: 'Bank' }),
    mkTxn({ type: 'expense', amount: 120000, date: new Date(today.getFullYear(), today.getMonth(), 3), description: 'Office rent (upcoming)', category: 'Rent', vendor_id: V['Office Rent'], status: 'pending', payment_method: 'Bank' }),
  )

  // Direct cash income (retainers / project milestones) across 6 months
  const incomeByMonth = [1850000, 2100000, 1750000, 2400000, 1980000, 2840000]
  for (let m = 5; m >= 0; m--) {
    const base = subMonths(today, m)
    const amt = incomeByMonth[5 - m]
    transactions.push(
      mkTxn({ type: 'income', amount: Math.round(amt * 0.45), date: new Date(base.getFullYear(), base.getMonth(), 12), description: 'Project milestone', category: 'Services', customer_id: C['ABC Technologies'], payment_method: 'Bank' }),
      mkTxn({ type: 'income', amount: Math.round(amt * 0.3), date: new Date(base.getFullYear(), base.getMonth(), 18), description: 'Monthly retainer', category: 'Services', customer_id: C['Tenneo'], payment_method: 'Bank' }),
      mkTxn({ type: 'income', amount: Math.round(amt * 0.25), date: new Date(base.getFullYear(), base.getMonth(), 24), description: 'Consulting fees', category: 'Consulting', customer_id: C['XYZ Corp'], payment_method: 'UPI' }),
    )
  }

  // --- Invoices + items + payments ---------------------------------------
  const invoices: Invoice[] = []
  const invoiceItems: InvoiceItem[] = []
  const payments: Payment[] = []

  function addInvoice(opts: {
    number: string
    customer: string
    issueDaysAgo: number
    dueInDays: number // relative to today (negative = past)
    items: { description: string; quantity: number; unit_price: number; tax_rate: number; discount: number }[]
    paid?: number
    draft?: boolean
  }) {
    const invId = uid('inv')
    const items: InvoiceItem[] = opts.items.map((it) => ({
      id: uid('itm'),
      invoice_id: invId,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      tax_rate: it.tax_rate,
      discount: it.discount,
      line_total: Math.round(it.quantity * it.unit_price * (1 - it.discount / 100) * 100) / 100,
    }))
    const totals = computeInvoiceTotals(items)
    const issue = subDays(today, opts.issueDaysAgo)
    const due = subDays(today, -opts.dueInDays)
    const paid = opts.paid ?? 0
    const inv: Invoice = {
      id: invId,
      company_id: DEMO_COMPANY_ID,
      invoice_number: opts.number,
      customer_id: C[opts.customer],
      issue_date: iso(issue),
      due_date: iso(due),
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      paid_amount: paid,
      outstanding_amount: invoiceOutstanding({ total: totals.total, paid_amount: paid }),
      status: opts.draft
        ? 'draft'
        : deriveInvoiceStatus({ total: totals.total, paid_amount: paid, due_date: iso(due), status: 'sent' }, today),
      notes: 'Thank you for your business.',
      payment_instructions: 'Bank transfer to TalentRayz Technologies · A/C 000123456789 · IFSC HDFC0000123 · UPI talentrayz@hdfcbank',
      attachment_ids: [],
      created_at: nowISO(),
      updated_at: nowISO(),
      deleted_at: null,
      device_id: DEV,
      sync_status: 'synced',
    }
    invoices.push(inv)
    invoiceItems.push(...items)
    if (paid > 0) {
      payments.push({
        id: uid('pay'),
        company_id: DEMO_COMPANY_ID,
        invoice_id: invId,
        customer_id: C[opts.customer],
        vendor_id: null,
        amount: paid,
        date: iso(subDays(today, Math.max(1, opts.issueDaysAgo - 5))),
        payment_method: 'Bank',
        reference_number: 'NEFT-' + Math.floor(Math.random() * 1e6),
        notes: 'Part payment',
        direction: 'in',
        attachment_ids: [],
        created_at: nowISO(),
        updated_at: nowISO(),
        device_id: DEV,
        sync_status: 'synced',
      })
    }
  }

  // Overdue (aging spread)
  addInvoice({ number: 'INV-00120', customer: 'ABC Technologies', issueDaysAgo: 95, dueInDays: -65, items: [{ description: 'LMS platform — Phase 1', quantity: 1, unit_price: 240000, tax_rate: 0, discount: 0 }] })
  addInvoice({ number: 'INV-00121', customer: 'XYZ Corp', issueDaysAgo: 72, dueInDays: -42, items: [{ description: 'Corporate training portal', quantity: 1, unit_price: 110000, tax_rate: 0, discount: 0 }] })
  addInvoice({ number: 'INV-00122', customer: 'Tenneo', issueDaysAgo: 55, dueInDays: -25, items: [{ description: 'Content migration services', quantity: 1, unit_price: 70000, tax_rate: 0, discount: 0 }] })
  // Partially paid
  addInvoice({ number: 'INV-00128', customer: 'ABC Technologies', issueDaysAgo: 20, dueInDays: 10, items: [{ description: 'LMS implementation', quantity: 1, unit_price: 200000, tax_rate: 18, discount: 0 }], paid: 100000 })
  // Due this week
  addInvoice({ number: 'INV-00131', customer: 'XYZ Corp', issueDaysAgo: 3, dueInDays: 4, items: [{ description: 'Analytics dashboard build', quantity: 1, unit_price: 280000, tax_rate: 0, discount: 0 }] })
  // Upcoming
  addInvoice({ number: 'INV-00129', customer: 'Acme Consulting', issueDaysAgo: 10, dueInDays: 20, items: [{ description: 'Advisory retainer — Q3', quantity: 1, unit_price: 350000, tax_rate: 0, discount: 0 }] })
  addInvoice({ number: 'INV-00130', customer: 'Global Learning Solutions', issueDaysAgo: 5, dueInDays: 25, items: [{ description: 'Custom courseware development', quantity: 1, unit_price: 250000, tax_rate: 18, discount: 0 }] })
  // Paid (history)
  addInvoice({ number: 'INV-00105', customer: 'ABC Technologies', issueDaysAgo: 130, dueInDays: -100, items: [{ description: 'Discovery & UX', quantity: 1, unit_price: 300000, tax_rate: 0, discount: 0 }], paid: 300000 })
  addInvoice({ number: 'INV-00110', customer: 'Acme Consulting', issueDaysAgo: 115, dueInDays: -85, items: [{ description: 'Strategy workshop', quantity: 1, unit_price: 180000, tax_rate: 0, discount: 0 }], paid: 180000 })
  // Draft
  addInvoice({ number: 'INV-00132', customer: 'Global Learning Solutions', issueDaysAgo: 0, dueInDays: 30, items: [{ description: 'Phase 2 proposal (draft)', quantity: 1, unit_price: 150000, tax_rate: 18, discount: 0 }], draft: true })

  // --- Categories ---------------------------------------------------------
  const catNames: { name: string; type: 'income' | 'expense' }[] = [
    ...['Office', 'Travel', 'Food', 'Marketing', 'Software', 'Salaries', 'Contractors', 'Utilities', 'Rent', 'Equipment', 'Professional Services', 'Other'].map((n) => ({ name: n, type: 'expense' as const })),
    ...['Sales', 'Services', 'Consulting', 'Interest', 'Other'].map((n) => ({ name: n, type: 'income' as const })),
  ]
  const categories: Category[] = catNames.map((c) => ({
    id: uid('cat'),
    company_id: DEMO_COMPANY_ID,
    name: c.name,
    type: c.type,
    created_at: nowISO(),
  }))

  // --- Persist ------------------------------------------------------------
  await db.transaction('rw', db.tables, async () => {
    await db.companies.put(company)
    await db.users.put({
      id: uid('usr'),
      company_id: DEMO_COMPANY_ID,
      name: 'Ajay',
      email: 'ajay@talentrayz.com',
      role: 'Owner',
      created_at: nowISO(),
    })
    await db.customers.bulkPut(customers)
    await db.vendors.bulkPut(vendors)
    await db.events.bulkPut(events)
    await db.transactions.bulkPut(transactions)
    await db.invoices.bulkPut(invoices)
    await db.invoice_items.bulkPut(invoiceItems)
    await db.payments.bulkPut(payments)
    await db.categories.bulkPut(categories)
    await db.sync_metadata.put({
      device_id: DEV,
      sync_version: 0,
      connected: false,
      demo_mode: true,
      last_sync_at: undefined,
    })
  })

  setActiveCompanyId(DEMO_COMPANY_ID)
  localStorage.setItem('finsutra_demo', 'true')
}

export async function ensureDefaultCategories(companyId: string) {
  const existing = await db.categories.where('company_id').equals(companyId).count()
  if (existing > 0) return
  const catNames: { name: string; type: 'income' | 'expense' }[] = [
    ...['Office', 'Travel', 'Food', 'Marketing', 'Software', 'Salaries', 'Contractors', 'Utilities', 'Rent', 'Equipment', 'Professional Services', 'Other'].map((n) => ({ name: n, type: 'expense' as const })),
    ...['Sales', 'Services', 'Consulting', 'Interest', 'Other'].map((n) => ({ name: n, type: 'income' as const })),
  ]
  await db.categories.bulkPut(
    catNames.map((c) => ({
      id: uid('cat'),
      company_id: companyId,
      name: c.name,
      type: c.type,
      created_at: nowISO(),
    })),
  )
}
