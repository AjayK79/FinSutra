import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany, useInvoices, useCustomers } from '@/state/hooks'
import { receivablesSummary, openInvoices, invoiceOutstanding, agingBucket, deriveInvoiceStatus, daysUntil, type AgingBucket } from '@/lib/calc'
import { formatMoney, formatDate } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui/StatCard'
import { Card, Tabs, EmptyState, InvoiceStatusBadge } from '@/components/ui/primitives'
import { Wallet, AlertTriangle, Clock, CalendarClock } from 'lucide-react'

type Bucket = 'all' | AgingBucket

export function Receivables() {
  const company = useCompany()
  const invoices = useInvoices()
  const customers = useCustomers()
  const navigate = useNavigate()
  const cur = company?.currency ?? 'INR'
  const [bucket, setBucket] = useState<Bucket>('all')

  const summary = useMemo(() => receivablesSummary(invoices), [invoices])
  const open = useMemo(() => openInvoices(invoices), [invoices])
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? '—'

  const filtered = open
    .filter((i) => bucket === 'all' || agingBucket(i.due_date) === bucket)
    .sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date))

  const bucketCount = (b: AgingBucket) => open.filter((i) => agingBucket(i.due_date) === b).length

  return (
    <div className="space-y-5">
      <PageHeader title="Receivables" subtitle="Money customers owe you" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Outstanding" value={formatMoney(summary.totalOutstanding, cur)} icon={<Wallet className="h-4 w-4" />} tone="brand" />
        <StatCard label="Overdue" value={formatMoney(summary.overdue, cur)} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label="Due This Week" value={formatMoney(summary.dueThisWeek, cur)} icon={<Clock className="h-4 w-4" />} tone="amber" />
        <StatCard label="Upcoming" value={formatMoney(summary.upcoming, cur)} icon={<CalendarClock className="h-4 w-4" />} tone="green" />
      </div>

      <Tabs
        value={bucket}
        onChange={setBucket}
        tabs={[
          { key: 'all', label: 'All', count: open.length },
          { key: 'current', label: 'Current', count: bucketCount('current') },
          { key: '1-30', label: '1–30 days', count: bucketCount('1-30') },
          { key: '31-60', label: '31–60 days', count: bucketCount('31-60') },
          { key: '61-90', label: '61–90 days', count: bucketCount('61-90') },
          { key: '90+', label: '90+ days', count: bucketCount('90+') },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={<Wallet className="h-5 w-5" />} title="Nothing outstanding here" body="No invoices in this aging bucket." />
      ) : (
        <Card className="overflow-hidden">
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Outstanding</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filtered.map((i) => {
                const d = daysUntil(i.due_date)
                return (
                  <tr key={i.id} onClick={() => navigate(`/invoices/${i.id}`)} className="cursor-pointer hover:bg-ink-50/60">
                    <td className="px-5 py-3 font-medium text-ink-800">{cName(i.customer_id)}</td>
                    <td className="px-5 py-3 text-ink-600">{i.invoice_number}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="text-ink-600">{formatDate(i.due_date)}</span>
                      {d < 0 && <span className="ml-2 text-xs font-semibold text-rose-600">{Math.abs(d)}d overdue</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-700 tnum">{formatMoney(i.total, cur)}</td>
                    <td className="px-5 py-3 text-right text-emerald-600 tnum">{formatMoney(i.paid_amount, cur)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink-900 tnum">{formatMoney(invoiceOutstanding(i), cur)}</td>
                    <td className="px-5 py-3"><InvoiceStatusBadge status={deriveInvoiceStatus(i)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="divide-y divide-ink-100 sm:hidden">
            {filtered.map((i) => (
              <button key={i.id} onClick={() => navigate(`/invoices/${i.id}`)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-800">{cName(i.customer_id)}</p>
                  <p className="text-xs text-ink-400">{i.invoice_number} · due {formatDate(i.due_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink-900 tnum">{formatMoney(invoiceOutstanding(i), cur)}</p>
                  <InvoiceStatusBadge status={deriveInvoiceStatus(i)} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
