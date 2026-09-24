// ---------------------------------------------------------------------------
// AICFOService — answers questions about the business using ONLY the local
// ledger. It never fabricates numbers; if the data can't support an answer it
// says so. Runs on-device, offline.
// ---------------------------------------------------------------------------

import {
  receivablesSummary,
  openInvoices,
  invoiceOutstanding,
  payablesFromTransactions,
  categoryTotals,
  daysUntil,
  dashboardMetrics,
  customerTotals,
} from '@/lib/calc'
import { formatMoney } from '@/lib/format'
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from 'date-fns'
import { safeDate } from '@/lib/format'
import type {
  Transaction,
  Invoice,
  Customer,
  Vendor,
  Payment,
  Company,
} from '@/db/types'

export interface CFOContext {
  company: Company
  transactions: Transaction[]
  invoices: Invoice[]
  customers: Customer[]
  vendors: Vendor[]
  payments: Payment[]
}

export interface CFOAnswer {
  text: string
  bullets?: { label: string; value: string; sub?: string }[]
  action?: { label: string; to: string }
  followUp?: string[]
}

const NO_DATA = "I don't have enough recorded information to answer that yet."

function customerName(ctx: CFOContext, id?: string | null) {
  return ctx.customers.find((c) => c.id === id)?.name ?? 'Unknown'
}

function findParty(ctx: CFOContext, q: string): Customer | Vendor | null {
  const lower = q.toLowerCase()
  const all = [...ctx.customers, ...ctx.vendors]
  // longest-name-first so "ABC Technologies" beats "ABC"
  const sorted = all.sort((a, b) => b.name.length - a.name.length)
  for (const p of sorted) {
    const name = p.name.toLowerCase()
    const firstWord = name.split(/\s+/)[0]
    if (lower.includes(name) || (firstWord.length >= 3 && lower.includes(firstWord))) {
      return p
    }
  }
  return null
}

function rangeFor(q: string, now = new Date()): { start: Date; end: Date; label: string } {
  const lower = q.toLowerCase()
  if (lower.includes('last month')) {
    const m = subMonths(now, 1)
    return { start: startOfMonth(m), end: endOfMonth(m), label: 'last month' }
  }
  if (lower.includes('this quarter') || lower.includes('quarter')) {
    return { start: startOfQuarter(now), end: endOfQuarter(now), label: 'this quarter' }
  }
  if (lower.includes('this year') || lower.includes('year')) {
    return { start: startOfYear(now), end: endOfYear(now), label: 'this year' }
  }
  return { start: startOfMonth(now), end: endOfMonth(now), label: 'this month' }
}

export const AICFOService = {
  suggestedQuestions(): string[] {
    return [
      'Who owes me money?',
      'What did I spend this month?',
      'What are my biggest expenses?',
      'Which invoices are overdue?',
      'What payments are due next week?',
      'What was my revenue last month?',
      'How much did I spend on travel?',
      'Which customers have outstanding balances?',
      'How much money do I have?',
    ]
  },

  answer(question: string, ctx: CFOContext): CFOAnswer {
    const q = question.toLowerCase().trim()
    const cur = ctx.company?.currency ?? 'INR'
    const hasData = ctx.transactions.length > 0 || ctx.invoices.length > 0

    // --- Cash position -----------------------------------------------------
    if (/(how much (money|cash)|cash position|balance|do i have)/.test(q)) {
      if (!hasData) return { text: NO_DATA }
      const m = dashboardMetrics(ctx.transactions, ctx.invoices)
      return {
        text: `Your current cash position is ${formatMoney(m.cashPosition, cur)}. This month you've brought in ${formatMoney(m.monthRevenue, cur)} and spent ${formatMoney(m.monthExpenses, cur)}, a net movement of ${formatMoney(m.netMovement, cur, { sign: true })}.`,
        bullets: [
          { label: 'Cash position', value: formatMoney(m.cashPosition, cur) },
          { label: 'Receivables', value: formatMoney(m.receivables, cur) },
          { label: 'Payables', value: formatMoney(m.payables, cur) },
        ],
        action: { label: 'Open Dashboard', to: '/dashboard' },
      }
    }

    // --- Who owes me money / receivables -----------------------------------
    if (/(who owes|owes me|receivable|outstanding.*(customer|balance)|customers.*outstanding|money.*owe.*me)/.test(q)) {
      const open = openInvoices(ctx.invoices)
      if (open.length === 0) return { text: 'Nobody owes you money right now — every invoice is fully paid. 🎉' }
      const summary = receivablesSummary(ctx.invoices)
      // group by customer
      const byCustomer = new Map<string, number>()
      for (const inv of open) {
        byCustomer.set(inv.customer_id, (byCustomer.get(inv.customer_id) ?? 0) + invoiceOutstanding(inv))
      }
      const ranked = Array.from(byCustomer.entries())
        .map(([id, amt]) => ({ id, amt, name: customerName(ctx, id) }))
        .sort((a, b) => b.amt - a.amt)
      const top = ranked.slice(0, 3)
      return {
        text: `You currently have ${formatMoney(summary.totalOutstanding, cur)} in outstanding receivables across ${byCustomer.size} customer${byCustomer.size === 1 ? '' : 's'}. ${formatMoney(summary.overdue, cur)} is overdue.`,
        bullets: top.map((t) => ({ label: t.name, value: formatMoney(t.amt, cur) })),
        action: { label: 'View Receivables', to: '/receivables' },
        followUp: ['Which invoices are overdue?', 'What payments are due next week?'],
      }
    }

    // --- Who do I owe / payables -------------------------------------------
    if (/(who do i owe|payable|i owe|bills? due|money i owe)/.test(q)) {
      const p = payablesFromTransactions(ctx.transactions.filter((t) => !t.deleted_at))
      if (p.totalPayable <= 0) return { text: 'You have no outstanding payables recorded right now.' }
      return {
        text: `You owe ${formatMoney(p.totalPayable, cur)} in total. ${formatMoney(p.overdue, cur)} is overdue and ${formatMoney(p.dueThisWeek, cur)} is due this week.`,
        bullets: [
          { label: 'Overdue', value: formatMoney(p.overdue, cur) },
          { label: 'Due this week', value: formatMoney(p.dueThisWeek, cur) },
          { label: 'Upcoming', value: formatMoney(p.upcoming, cur) },
        ],
        action: { label: 'View Payables', to: '/payables' },
      }
    }

    // --- Overdue invoices --------------------------------------------------
    if (/overdue/.test(q)) {
      const overdue = openInvoices(ctx.invoices)
        .filter((i) => daysUntil(i.due_date) < 0)
        .sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date))
      if (overdue.length === 0) return { text: 'Good news — you have no overdue invoices.' }
      const total = overdue.reduce((s, i) => s + invoiceOutstanding(i), 0)
      return {
        text: `You have ${overdue.length} overdue invoice${overdue.length === 1 ? '' : 's'} totalling ${formatMoney(total, cur)}.`,
        bullets: overdue.slice(0, 5).map((i) => ({
          label: `${i.invoice_number} · ${customerName(ctx, i.customer_id)}`,
          value: formatMoney(invoiceOutstanding(i), cur),
          sub: `${Math.abs(daysUntil(i.due_date))} days overdue`,
        })),
        action: { label: 'View Receivables', to: '/receivables' },
      }
    }

    // --- Payments due next week / soon -------------------------------------
    if (/(due (next|this) week|due soon|payments? due|upcoming)/.test(q)) {
      const soon = openInvoices(ctx.invoices)
        .filter((i) => {
          const d = daysUntil(i.due_date)
          return d >= 0 && d <= 7
        })
        .sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date))
      if (soon.length === 0) return { text: 'No invoice payments are due within the next 7 days.' }
      const total = soon.reduce((s, i) => s + invoiceOutstanding(i), 0)
      return {
        text: `${formatMoney(total, cur)} is expected within the next week across ${soon.length} invoice${soon.length === 1 ? '' : 's'}.`,
        bullets: soon.map((i) => ({
          label: `${i.invoice_number} · ${customerName(ctx, i.customer_id)}`,
          value: formatMoney(invoiceOutstanding(i), cur),
          sub: `due in ${daysUntil(i.due_date)} day${daysUntil(i.due_date) === 1 ? '' : 's'}`,
        })),
        action: { label: 'View Receivables', to: '/receivables' },
      }
    }

    // --- Party-specific: how much did X pay me / I owe X -------------------
    if (/(how much did|paid me|from|to)\s+/.test(q) && findParty(ctx, q)) {
      const party = findParty(ctx, q)!
      const isCustomer = ctx.customers.some((c) => c.id === party.id)
      if (isCustomer) {
        const t = customerTotals(party.id, ctx.invoices, ctx.payments)
        return {
          text: `${party.name} has been billed ${formatMoney(t.totalBilled, cur)} and has paid ${formatMoney(t.totalReceived, cur)}. Outstanding balance is ${formatMoney(t.outstanding, cur)}.`,
          bullets: [
            { label: 'Total billed', value: formatMoney(t.totalBilled, cur) },
            { label: 'Received', value: formatMoney(t.totalReceived, cur) },
            { label: 'Outstanding', value: formatMoney(t.outstanding, cur) },
          ],
          action: { label: `Open ${party.name}`, to: `/customers/${party.id}` },
        }
      }
      const spent = ctx.transactions
        .filter((tr) => tr.vendor_id === party.id && tr.type === 'expense' && !tr.deleted_at)
        .reduce((s, tr) => s + tr.amount, 0)
      return {
        text: `You've spent ${formatMoney(spent, cur)} with ${party.name} in total.`,
        action: { label: `Open ${party.name}`, to: `/vendors/${party.id}` },
      }
    }

    // --- Category spend: how much on travel/marketing/etc ------------------
    const categoryMatch = q.match(
      /(?:spend|spent|spending).*(?:on|for)\s+([a-z ]+?)(?:\s+(?:this|last|in)\b|\?|$)/,
    )
    if (categoryMatch) {
      const catQuery = categoryMatch[1].trim()
      const range = rangeFor(q)
      const totals = categoryTotals(
        ctx.transactions,
        'expense',
        q.includes('this') || q.includes('last') || q.includes('quarter') || q.includes('year')
          ? range
          : undefined,
      )
      const match = totals.find((t) => t.category.toLowerCase().includes(catQuery) || catQuery.includes(t.category.toLowerCase()))
      if (match) {
        return {
          text: `You've spent ${formatMoney(match.total, cur)} on ${match.category}${q.includes('this') || q.includes('last') ? ` ${range.label}` : ''}.`,
          action: { label: 'View Reports', to: '/reports' },
        }
      }
      return { text: `I couldn't find any recorded spending on "${catQuery}".` }
    }

    // --- Biggest expenses --------------------------------------------------
    if (/(biggest|top|largest|main).*(expense|spend|cost)/.test(q)) {
      const totals = categoryTotals(ctx.transactions, 'expense')
      if (totals.length === 0) return { text: NO_DATA }
      const top = totals.slice(0, 5)
      return {
        text: `Your biggest expense categories are led by ${top[0].category} at ${formatMoney(top[0].total, cur)}.`,
        bullets: top.map((t) => ({ label: t.category, value: formatMoney(t.total, cur) })),
        action: { label: 'View Reports', to: '/reports' },
      }
    }

    // --- Spend this/last month ---------------------------------------------
    if (/(what did i spend|how much did i spend|expenses|spending|total spend)/.test(q)) {
      const range = rangeFor(q)
      const total = ctx.transactions
        .filter((t) => {
          if (t.type !== 'expense' || t.deleted_at) return false
          const d = safeDate(t.date)
          return d && isWithinInterval(d, { start: range.start, end: range.end })
        })
        .reduce((s, t) => s + t.amount, 0)
      if (total === 0) return { text: `You have no expenses recorded for ${range.label}.` }
      const totals = categoryTotals(ctx.transactions, 'expense', range)
      return {
        text: `You spent ${formatMoney(total, cur)} ${range.label}.`,
        bullets: totals.slice(0, 4).map((t) => ({ label: t.category, value: formatMoney(t.total, cur) })),
        action: { label: 'View Transactions', to: '/transactions' },
      }
    }

    // --- Revenue this/last month -------------------------------------------
    if (/(revenue|income|earn|made|turnover|sales)/.test(q)) {
      const range = rangeFor(q)
      const total = ctx.transactions
        .filter((t) => {
          if (t.type !== 'income' || t.deleted_at) return false
          const d = safeDate(t.date)
          return d && isWithinInterval(d, { start: range.start, end: range.end })
        })
        .reduce((s, t) => s + t.amount, 0)
      if (total === 0) return { text: `You have no income recorded for ${range.label}.` }
      return {
        text: `Your revenue for ${range.label} was ${formatMoney(total, cur)}.`,
        action: { label: 'View Reports', to: '/reports' },
      }
    }

    // --- Fallback ----------------------------------------------------------
    if (!hasData) return { text: NO_DATA }
    return {
      text: "I can answer questions about your cash, receivables, payables, invoices, spending and revenue. Try one of the suggestions below.",
      followUp: this.suggestedQuestions().slice(0, 4),
    }
  },
}
