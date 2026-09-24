import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany, useInvoices, useCustomers } from '@/state/hooks'
import { formatMoney, formatDate } from '@/lib/format'
import { deriveInvoiceStatus, invoiceOutstanding } from '@/lib/calc'
import { PageHeader } from '@/components/ui/StatCard'
import { Card, Tabs, EmptyState, InvoiceStatusBadge, Avatar } from '@/components/ui/primitives'
import { Plus, Search, FileText } from 'lucide-react'
import type { Invoice, InvoiceStatus } from '@/db/types'

type Tab = 'all' | InvoiceStatus

export function Invoices() {
  const company = useCompany()
  const invoices = useInvoices()
  const customers = useCustomers()
  const navigate = useNavigate()
  const cur = company?.currency ?? 'INR'
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')

  const withStatus = useMemo(
    () => invoices.map((i) => ({ ...i, effStatus: deriveInvoiceStatus(i) })),
    [invoices],
  )

  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? '—'

  const filtered = withStatus.filter((i) => {
    if (tab !== 'all' && i.effStatus !== tab) return false
    if (q) {
      const hay = `${i.invoice_number} ${cName(i.customer_id)}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })

  const count = (s: Tab) => (s === 'all' ? invoices.length : withStatus.filter((i) => i.effStatus === s).length)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle="Create, send and track what you've billed"
        actions={<button onClick={() => navigate('/invoices/new')} className="btn-primary"><Plus className="h-4 w-4" /> New Invoice</button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All', count: count('all') },
            { key: 'draft', label: 'Draft', count: count('draft') },
            { key: 'sent', label: 'Sent', count: count('sent') },
            { key: 'partially_paid', label: 'Partial', count: count('partially_paid') },
            { key: 'paid', label: 'Paid', count: count('paid') },
            { key: 'overdue', label: 'Overdue', count: count('overdue') },
          ]}
        />
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoices…" className="input pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="No invoices here" body="Create your first invoice to start tracking receivables." action={<button onClick={() => navigate('/invoices/new')} className="btn-primary"><Plus className="h-4 w-4" /> New Invoice</button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="hidden w-full sm:table">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Outstanding</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filtered.map((i) => (
                <tr key={i.id} onClick={() => navigate(`/invoices/${i.id}`)} className="cursor-pointer text-sm hover:bg-ink-50/60">
                  <td className="px-5 py-3 font-semibold text-ink-800">{i.invoice_number}</td>
                  <td className="px-5 py-3 text-ink-700">{cName(i.customer_id)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-500">{formatDate(i.due_date)}</td>
                  <td className="px-5 py-3 text-right font-medium text-ink-800 tnum">{formatMoney(i.total, cur)}</td>
                  <td className="px-5 py-3 text-right font-semibold tnum text-ink-900">{formatMoney(invoiceOutstanding(i), cur)}</td>
                  <td className="px-5 py-3"><InvoiceStatusBadge status={i.effStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="divide-y divide-ink-100 sm:hidden">
            {filtered.map((i) => (
              <button key={i.id} onClick={() => navigate(`/invoices/${i.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <Avatar name={cName(i.customer_id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-800">{i.invoice_number} · {cName(i.customer_id)}</p>
                  <p className="text-xs text-ink-400">Due {formatDate(i.due_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink-900 tnum">{formatMoney(invoiceOutstanding(i), cur)}</p>
                  <InvoiceStatusBadge status={i.effStatus} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
