import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCompany, useTransactions, useInvoices, useCustomers, useVendors } from '@/state/hooks'
import {
  dashboardMetrics,
  cashFlowByMonth,
  receivablesSummary,
  payablesFromTransactions,
  openInvoices,
  invoiceOutstanding,
  daysUntil,
} from '@/lib/calc'
import { formatMoney, formatMoneyCompact, formatDate } from '@/lib/format'
import { StatCard, PageHeader } from '@/components/ui/StatCard'
import { Card, InvoiceStatusBadge, Avatar, EmptyState } from '@/components/ui/primitives'
import { CashFlowChart } from '@/components/charts/Charts'
import { useApp } from '@/state/store'
import {
  Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, Receipt, HandCoins,
  AlertTriangle, Clock, ChevronRight, Plus, Sparkles,
} from 'lucide-react'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const company = useCompany()
  const transactions = useTransactions()
  const invoices = useInvoices()
  const customers = useCustomers()
  const vendors = useVendors()
  const navigate = useNavigate()
  const openRecord = useApp((s) => s.openRecord)

  const cur = company?.currency ?? 'INR'
  const metrics = useMemo(() => dashboardMetrics(transactions, invoices), [transactions, invoices])
  const cashFlow = useMemo(() => cashFlowByMonth(transactions, 6), [transactions])
  const rec = useMemo(() => receivablesSummary(invoices), [invoices])
  const pay = useMemo(() => payablesFromTransactions(transactions.filter((t) => !t.deleted_at)), [transactions])

  const recent = transactions.slice(0, 8)
  const partyName = (t: (typeof transactions)[number]) =>
    customers.find((c) => c.id === t.customer_id)?.name ?? vendors.find((v) => v.id === t.vendor_id)?.name ?? '—'

  const overdueInv = openInvoices(invoices).filter((i) => daysUntil(i.due_date) < 0)
  const dueSoonInv = openInvoices(invoices).filter((i) => { const d = daysUntil(i.due_date); return d >= 0 && d <= 7 })
  const partialInv = invoices.filter((i) => i.status === 'partially_paid')

  const actions: { icon: typeof AlertTriangle; tone: string; text: string; to: string }[] = []
  if (overdueInv.length) actions.push({ icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50', text: `${overdueInv.length} invoice${overdueInv.length > 1 ? 's' : ''} overdue`, to: '/receivables' })
  if (dueSoonInv.length) actions.push({ icon: Clock, tone: 'text-amber-600 bg-amber-50', text: `${dueSoonInv.length} payment${dueSoonInv.length > 1 ? 's' : ''} due this week`, to: '/receivables' })
  if (partialInv.length) actions.push({ icon: HandCoins, tone: 'text-sky-600 bg-sky-50', text: `${partialInv.length} invoice${partialInv.length > 1 ? 's' : ''} partially paid`, to: '/invoices' })
  if (pay.overdue > 0) actions.push({ icon: Receipt, tone: 'text-violet-600 bg-violet-50', text: `${formatMoney(pay.overdue, cur)} in overdue payables`, to: '/payables' })

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting()}, ${company?.owner_name ?? 'there'}`}
        subtitle={company?.name}
        actions={
          <>
            <button onClick={() => openRecord('ai')} className="btn-secondary hidden sm:inline-flex">
              <Sparkles className="h-4 w-4" /> Ask AI
            </button>
            <button onClick={() => openRecord('menu')} className="btn-primary">
              <Plus className="h-4 w-4" /> Record
            </button>
          </>
        }
      />

      {/* Primary KPIs — the four questions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cash Position" value={formatMoney(metrics.cashPosition, cur)} icon={<Wallet className="h-4 w-4" />} tone="hero" sub="How much you have" />
        <StatCard label="Receivables" value={formatMoney(metrics.receivables, cur)} icon={<ArrowDownLeft className="h-4 w-4" />} tone="green" sub="Owed to you" onClick={() => navigate('/receivables')} />
        <StatCard label="Payables" value={formatMoney(metrics.payables, cur)} icon={<ArrowUpRight className="h-4 w-4" />} tone="red" sub="You owe" onClick={() => navigate('/payables')} />
        <StatCard label="Net This Month" value={formatMoney(metrics.netMovement, cur, { sign: true })} icon={<TrendingUp className="h-4 w-4" />} tone={metrics.netMovement >= 0 ? 'blue' : 'amber'} sub={`${formatMoneyCompact(metrics.monthRevenue, cur)} in · ${formatMoneyCompact(metrics.monthExpenses, cur)} out`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Cash flow */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Cash Flow</h2>
              <p className="text-sm text-ink-500">Income vs expenses · last 6 months</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-xs text-ink-400">This month revenue</p>
              <p className="text-lg font-bold text-emerald-600 tnum">{formatMoney(metrics.monthRevenue, cur)}</p>
            </div>
          </div>
          <CashFlowChart data={cashFlow} currency={cur} />
        </Card>

        {/* Action required */}
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Action Required</h2>
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">✓</div>
              <p className="text-sm font-medium text-ink-700">Nothing needs attention</p>
              <p className="mt-1 text-xs text-ink-400">You're on top of everything.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {actions.map((a, i) => (
                <Link key={i} to={a.to} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3 transition hover:bg-ink-50">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.tone}`}>
                    <a.icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-ink-700">{a.text}</span>
                  <ChevronRight className="h-4 w-4 text-ink-300" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Receivables + Payables summary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SummaryCard title="Receivables" subtitle="Money customers owe you" to="/receivables" total={rec.totalOutstanding} cur={cur}
          rows={[
            { label: 'Overdue', value: rec.overdue, tone: 'text-rose-600' },
            { label: 'Due this week', value: rec.dueThisWeek, tone: 'text-amber-600' },
            { label: 'Upcoming', value: rec.upcoming, tone: 'text-ink-700' },
          ]}
        />
        <SummaryCard title="Payables" subtitle="Money you owe" to="/payables" total={pay.totalPayable} cur={cur}
          rows={[
            { label: 'Overdue', value: pay.overdue, tone: 'text-rose-600' },
            { label: 'Due this week', value: pay.dueThisWeek, tone: 'text-amber-600' },
            { label: 'Upcoming', value: pay.upcoming, tone: 'text-ink-700' },
          ]}
        />
      </div>

      {/* Recent transactions */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">Recent Transactions</h2>
          <Link to="/transactions" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 pb-6">
            <EmptyState title="No transactions yet" body="Record your first income or expense to see it here." action={<button onClick={() => openRecord('menu')} className="btn-primary"><Plus className="h-4 w-4" /> Record</button>} />
          </div>
        ) : (
          <div className="divide-y divide-ink-100 border-t border-ink-100">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 'bg-violet-50 text-violet-600'}`}>
                  {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : t.type === 'expense' ? <ArrowUpRight className="h-4 w-4" /> : <HandCoins className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{t.description}</p>
                  <p className="truncate text-xs text-ink-400">{partyName(t)} · {t.category} · {formatDate(t.date)}</p>
                </div>
                {t.status === 'pending' && <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 sm:inline">Pending</span>}
                <span className={`shrink-0 text-sm font-semibold tnum ${t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-ink-700'}`}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatMoney(t.amount, cur)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function SummaryCard({
  title, subtitle, to, total, cur, rows,
}: {
  title: string; subtitle: string; to: string; total: number; cur: string
  rows: { label: string; value: number; tone: string }[]
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <p className="text-sm text-ink-500">{subtitle}</p>
        </div>
        <Link to={to} className="text-sm font-medium text-brand-600 hover:underline">Open</Link>
      </div>
      <p className="mb-4 text-2xl font-bold text-ink-900 tnum">{formatMoney(total, cur)}</p>
      <div className="grid grid-cols-3 gap-3">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-ink-50 p-3">
            <p className="text-xs text-ink-400">{r.label}</p>
            <p className={`mt-1 text-sm font-bold tnum ${r.tone}`}>{formatMoney(r.value, cur)}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
