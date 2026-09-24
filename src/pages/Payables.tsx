import { useMemo } from 'react'
import { useCompany, useTransactions, useVendors } from '@/state/hooks'
import { payablesFromTransactions, daysUntil } from '@/lib/calc'
import { formatMoney, formatDate } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui/StatCard'
import { Card, EmptyState, Badge } from '@/components/ui/primitives'
import { updateTransaction } from '@/db/repo'
import { toast, useApp } from '@/state/store'
import { Receipt, AlertTriangle, Clock, CalendarClock, CheckCircle2 } from 'lucide-react'

export function Payables() {
  const company = useCompany()
  const transactions = useTransactions()
  const vendors = useVendors()
  const askConfirm = useApp((s) => s.askConfirm)
  const cur = company?.currency ?? 'INR'

  const pending = useMemo(
    () => transactions.filter((t) => t.type === 'expense' && t.status === 'pending' && !t.deleted_at).sort((a, b) => daysUntil(a.date) - daysUntil(b.date)),
    [transactions],
  )
  const summary = useMemo(() => payablesFromTransactions(transactions.filter((t) => !t.deleted_at)), [transactions])
  const vName = (id?: string | null) => vendors.find((v) => v.id === id)?.name ?? '—'

  const markPaid = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await askConfirm({ title: 'Mark as paid?', body: 'This records the bill as paid and moves it out of payables.', confirmLabel: 'Mark paid' })
    if (!ok) return
    await updateTransaction(id, { status: 'completed', date: new Date().toISOString().slice(0, 10) })
    toast('success', 'Bill marked as paid.')
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Payables" subtitle="Money you owe" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Payable" value={formatMoney(summary.totalPayable, cur)} icon={<Receipt className="h-4 w-4" />} tone="brand" />
        <StatCard label="Overdue" value={formatMoney(summary.overdue, cur)} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label="Due This Week" value={formatMoney(summary.dueThisWeek, cur)} icon={<Clock className="h-4 w-4" />} tone="amber" />
        <StatCard label="Upcoming" value={formatMoney(summary.upcoming, cur)} icon={<CalendarClock className="h-4 w-4" />} tone="green" />
      </div>

      {pending.length === 0 ? (
        <EmptyState icon={<Receipt className="h-5 w-5" />} title="You're all paid up" body="No outstanding bills to pay. Record a bill via + Record → Invoice Received." />
      ) : (
        <Card className="overflow-hidden">
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Vendor</th>
                <th className="px-5 py-3">Bill</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3 text-right">Outstanding</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {pending.map((t) => {
                const d = daysUntil(t.date)
                return (
                  <tr key={t.id} className="hover:bg-ink-50/60">
                    <td className="px-5 py-3 font-medium text-ink-800">{vName(t.vendor_id)}</td>
                    <td className="px-5 py-3 text-ink-600">{t.description}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="text-ink-600">{formatDate(t.date)}</span>
                      {d < 0 && <span className="ml-2 text-xs font-semibold text-rose-600">{Math.abs(d)}d overdue</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-ink-900 tnum">{formatMoney(t.amount, cur)}</td>
                    <td className="px-5 py-3"><Badge tone={d < 0 ? 'red' : d <= 7 ? 'amber' : 'neutral'}>{d < 0 ? 'Overdue' : d <= 7 ? 'Due soon' : 'Upcoming'}</Badge></td>
                    <td className="px-5 py-3 text-right"><button onClick={(e) => markPaid(t.id, e)} className="btn-ghost text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Mark paid</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="divide-y divide-ink-100 sm:hidden">
            {pending.map((t) => {
              const d = daysUntil(t.date)
              return (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{vName(t.vendor_id)}</p>
                    <p className="truncate text-xs text-ink-400">{t.description} · due {formatDate(t.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-900 tnum">{formatMoney(t.amount, cur)}</p>
                    <button onClick={(e) => markPaid(t.id, e)} className="text-xs font-semibold text-emerald-600">Mark paid</button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
