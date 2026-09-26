import { differenceInCalendarDays, startOfMonth, subMonths, isWithinInterval, endOfMonth } from 'date-fns'
import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Transaction,
  Payment,
  Customer,
  Vendor,
} from '@/db/types'
import { safeDate } from './format'

// --- Invoice line & total math -------------------------------------------

export function computeLineTotal(item: {
  quantity: number
  unit_price: number
  tax_rate: number
  discount: number
}): number {
  const gross = item.quantity * item.unit_price
  const afterDiscount = gross * (1 - (item.discount || 0) / 100)
  return round2(afterDiscount)
}

export function computeInvoiceTotals(items: InvoiceItem[]) {
  let subtotal = 0
  let tax = 0
  let discount = 0
  for (const it of items) {
    const gross = it.quantity * it.unit_price
    const disc = gross * ((it.discount || 0) / 100)
    const base = gross - disc
    const lineTax = base * ((it.tax_rate || 0) / 100)
    subtotal += gross
    discount += disc
    tax += lineTax
  }
  const total = subtotal - discount + tax
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    tax: round2(tax),
    total: round2(total),
  }
}

/**
 * Given an invoice's total, paid amount and due date, derive its live status.
 * Draft/sent are explicit states the user sets; everything else is money-driven.
 */
export function deriveInvoiceStatus(
  invoice: Pick<Invoice, 'total' | 'paid_amount' | 'due_date' | 'status'>,
  today = new Date(),
): InvoiceStatus {
  if (invoice.status === 'draft') return 'draft'
  const outstanding = round2(invoice.total - invoice.paid_amount)
  if (outstanding <= 0.001) return 'paid'
  const due = safeDate(invoice.due_date)
  const overdue = due ? differenceInCalendarDays(today, due) > 0 : false
  if (invoice.paid_amount > 0.001) {
    // partial — but still flag overdue if past due
    return overdue ? 'overdue' : 'partially_paid'
  }
  if (overdue) return 'overdue'
  return invoice.status === 'sent' ? 'sent' : 'sent'
}

export function invoiceOutstanding(inv: Pick<Invoice, 'total' | 'paid_amount'>) {
  return Math.max(0, round2(inv.total - inv.paid_amount))
}

// --- Aging ----------------------------------------------------------------

export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

export function agingBucket(dueDate: string, today = new Date()): AgingBucket {
  const due = safeDate(dueDate)
  if (!due) return 'current'
  const daysOverdue = differenceInCalendarDays(today, due)
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

export function daysOverdue(dueDate: string, today = new Date()): number {
  const due = safeDate(dueDate)
  if (!due) return 0
  return Math.max(0, differenceInCalendarDays(today, due))
}

export function daysUntil(dueDate: string, today = new Date()): number {
  const due = safeDate(dueDate)
  if (!due) return 0
  return differenceInCalendarDays(due, today)
}

// --- Receivables (from open invoices) ------------------------------------

export interface ReceivablesSummary {
  totalOutstanding: number
  overdue: number
  dueThisWeek: number
  upcoming: number
}

export function receivablesSummary(
  invoices: Invoice[],
  today = new Date(),
): ReceivablesSummary {
  let totalOutstanding = 0
  let overdue = 0
  let dueThisWeek = 0
  let upcoming = 0
  for (const inv of openInvoices(invoices)) {
    const out = invoiceOutstanding(inv)
    totalOutstanding += out
    const d = daysUntil(inv.due_date, today)
    if (d < 0) overdue += out
    else if (d <= 7) dueThisWeek += out
    else upcoming += out
  }
  return {
    totalOutstanding: round2(totalOutstanding),
    overdue: round2(overdue),
    dueThisWeek: round2(dueThisWeek),
    upcoming: round2(upcoming),
  }
}

export function openInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter(
    (i) =>
      !i.deleted_at &&
      i.status !== 'draft' &&
      invoiceOutstanding(i) > 0.001,
  )
}

// --- Payables (from expense-side bills / open vendor payments) ------------
// In this MVP a "payable" is modelled as an expense transaction flagged
// pending, or a vendor bill. We derive payables from pending expense txns
// that carry a due date in notes/reference — simpler: pending expenses.

export interface PayablesSummary {
  totalPayable: number
  overdue: number
  dueThisWeek: number
  upcoming: number
}

// --- Customer / Vendor rollups -------------------------------------------

export interface PartyTotals {
  totalBilled: number
  totalReceived: number
  outstanding: number
}

export function customerTotals(
  customerId: string,
  invoices: Invoice[],
  payments: Payment[],
): PartyTotals {
  let totalBilled = 0
  let outstanding = 0
  for (const inv of invoices) {
    if (inv.customer_id !== customerId || inv.deleted_at) continue
    if (inv.status === 'draft') continue
    totalBilled += inv.total
    outstanding += invoiceOutstanding(inv)
  }
  let totalReceived = 0
  for (const p of payments) {
    if (p.customer_id === customerId && p.direction === 'in') {
      totalReceived += p.amount
    }
  }
  return {
    totalBilled: round2(totalBilled),
    totalReceived: round2(totalReceived),
    outstanding: round2(outstanding),
  }
}

export function vendorTotals(
  vendorId: string,
  transactions: Transaction[],
  payments: Payment[],
): { totalPurchases: number; totalPaid: number; outstanding: number } {
  let totalPurchases = 0
  for (const t of transactions) {
    if (t.vendor_id === vendorId && t.type === 'expense' && !t.deleted_at) {
      totalPurchases += t.amount
    }
  }
  let totalPaid = 0
  for (const p of payments) {
    if (p.vendor_id === vendorId && p.direction === 'out') {
      totalPaid += p.amount
    }
  }
  // In MVP purchases are recorded as already-paid expenses; outstanding is
  // any explicitly-pending expense txns.
  let outstanding = 0
  for (const t of transactions) {
    if (
      t.vendor_id === vendorId &&
      t.type === 'expense' &&
      t.status === 'pending' &&
      !t.deleted_at
    ) {
      outstanding += t.amount
    }
  }
  return {
    totalPurchases: round2(totalPurchases),
    totalPaid: round2(totalPaid),
    outstanding: round2(outstanding),
  }
}

// --- Dashboard ------------------------------------------------------------

export interface DashboardMetrics {
  cashPosition: number
  receivables: number
  payables: number
  monthRevenue: number
  monthExpenses: number
  netMovement: number
}

export function dashboardMetrics(
  transactions: Transaction[],
  invoices: Invoice[],
  today = new Date(),
): DashboardMetrics {
  const active = transactions.filter((t) => !t.deleted_at)
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  let cashIn = 0
  let cashOut = 0
  let monthRevenue = 0
  let monthExpenses = 0

  for (const t of active) {
    if (t.type === 'income') cashIn += t.amount
    else if (t.type === 'expense') cashOut += t.amount
    const d = safeDate(t.date)
    if (d && isWithinInterval(d, { start: monthStart, end: monthEnd })) {
      if (t.type === 'income') monthRevenue += t.amount
      else if (t.type === 'expense') monthExpenses += t.amount
    }
  }

  const rec = receivablesSummary(invoices, today)
  const payables = payablesFromTransactions(active, today)

  return {
    cashPosition: round2(cashIn - cashOut),
    receivables: rec.totalOutstanding,
    payables: payables.totalPayable,
    monthRevenue: round2(monthRevenue),
    monthExpenses: round2(monthExpenses),
    netMovement: round2(monthRevenue - monthExpenses),
  }
}

export function payablesFromTransactions(
  transactions: Transaction[],
  today = new Date(),
): PayablesSummary {
  let totalPayable = 0
  let overdue = 0
  let dueThisWeek = 0
  let upcoming = 0
  for (const t of transactions) {
    if (t.type !== 'expense' || t.status !== 'pending' || t.deleted_at) continue
    totalPayable += t.amount
    const d = daysUntil(t.date, today)
    if (d < 0) overdue += t.amount
    else if (d <= 7) dueThisWeek += t.amount
    else upcoming += t.amount
  }
  return {
    totalPayable: round2(totalPayable),
    overdue: round2(overdue),
    dueThisWeek: round2(dueThisWeek),
    upcoming: round2(upcoming),
  }
}

// --- Cash flow (last N months) -------------------------------------------

export interface MonthlyCashFlow {
  label: string
  monthKey: string
  income: number
  expenses: number
  net: number
}

export function cashFlowByMonth(
  transactions: Transaction[],
  months = 6,
  today = new Date(),
): MonthlyCashFlow[] {
  const buckets: MonthlyCashFlow[] = []
  for (let i = months - 1; i >= 0; i--) {
    const m = subMonths(today, i)
    const start = startOfMonth(m)
    const end = endOfMonth(m)
    let income = 0
    let expenses = 0
    for (const t of transactions) {
      if (t.deleted_at) continue
      const d = safeDate(t.date)
      if (!d || !isWithinInterval(d, { start, end })) continue
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') expenses += t.amount
    }
    buckets.push({
      label: start.toLocaleString('en-US', { month: 'short' }),
      monthKey: `${start.getFullYear()}-${start.getMonth() + 1}`,
      income: round2(income),
      expenses: round2(expenses),
      net: round2(income - expenses),
    })
  }
  return buckets
}

// --- Category spend -------------------------------------------------------

export function categoryTotals(
  transactions: Transaction[],
  type: 'income' | 'expense',
  range?: { start: Date; end: Date },
): { category: string; total: number }[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== type || t.deleted_at) continue
    if (range) {
      const d = safeDate(t.date)
      if (!d || !isWithinInterval(d, range)) continue
    }
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => b.total - a.total)
}

// --- Events ---------------------------------------------------------------

export interface EventTotals {
  received: number
  spent: number
  profit: number
  count: number
}

export function eventTotals(eventId: string, transactions: Transaction[]): EventTotals {
  let received = 0
  let spent = 0
  let count = 0
  for (const t of transactions) {
    if (t.event_id !== eventId || t.deleted_at) continue
    count++
    if (t.type === 'income') received += t.amount
    else if (t.type === 'expense') spent += t.amount
  }
  return { received: round2(received), spent: round2(spent), profit: round2(received - spent), count }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function sum<T>(arr: T[], fn: (t: T) => number): number {
  return round2(arr.reduce((acc, x) => acc + fn(x), 0))
}
