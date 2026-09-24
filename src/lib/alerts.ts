import { db } from '@/db/database'
import { activeCompanyId, pushNotification } from '@/db/repo'
import { openInvoices, invoiceOutstanding, daysUntil, payablesFromTransactions } from '@/lib/calc'
import { formatMoney, todayISO } from '@/lib/format'

const RUN_KEY = 'finsutra_alerts_run'

/**
 * Generate local notifications for overdue/upcoming items. Runs at most once
 * per day per device to avoid duplicates, and only when there's something new.
 */
export async function generateAlerts() {
  try {
    const companyId = activeCompanyId()
    if (!companyId) return
    if (localStorage.getItem(RUN_KEY) === todayISO()) return

    const [invoices, transactions] = await Promise.all([
      db.invoices.where('company_id').equals(companyId).toArray(),
      db.transactions.where('company_id').equals(companyId).toArray(),
    ])
    const open = openInvoices(invoices.filter((i) => !i.deleted_at))
    const overdue = open.filter((i) => daysUntil(i.due_date) < 0)
    const dueSoon = open.filter((i) => { const d = daysUntil(i.due_date); return d >= 0 && d <= 7 })
    const pay = payablesFromTransactions(transactions.filter((t) => !t.deleted_at))

    const cur = (await db.companies.get(companyId))?.currency ?? 'INR'

    if (overdue.length) {
      const total = overdue.reduce((s, i) => s + invoiceOutstanding(i), 0)
      await pushNotification({
        company_id: companyId, type: 'overdue',
        title: `${overdue.length} invoice${overdue.length > 1 ? 's' : ''} overdue`,
        body: `${formatMoney(total, cur)} is overdue from customers.`,
        link: '/receivables',
      })
    }
    if (dueSoon.length) {
      const total = dueSoon.reduce((s, i) => s + invoiceOutstanding(i), 0)
      await pushNotification({
        company_id: companyId, type: 'due_soon',
        title: `${dueSoon.length} payment${dueSoon.length > 1 ? 's' : ''} due this week`,
        body: `${formatMoney(total, cur)} expected within 7 days.`,
        link: '/receivables',
      })
    }
    if (pay.overdue > 0 || pay.dueThisWeek > 0) {
      await pushNotification({
        company_id: companyId, type: 'payable_due',
        title: 'Bills need paying',
        body: `${formatMoney(pay.overdue + pay.dueThisWeek, cur)} in payables due soon.`,
        link: '/payables',
      })
    }

    localStorage.setItem(RUN_KEY, todayISO())
  } catch {
    /* non-critical */
  }
}
