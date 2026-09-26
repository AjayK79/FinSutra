import { useMemo, useState } from 'react'
import { useCompany, useTransactions, useInvoices, useCustomers, useVendors, useEvents } from '@/state/hooks'
import {
  cashFlowByMonth, categoryTotals, receivablesSummary, payablesFromTransactions, agingBucket, openInvoices, invoiceOutstanding, gstSummary,
} from '@/lib/calc'
import { formatMoney, formatMoneyCompact, safeDate } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/primitives'
import { CashFlowChart, DonutChart } from '@/components/charts/Charts'
import { ExportService } from '@/services/ExportService'
import { BackupService } from '@/services/BackupService'
import { toast } from '@/state/store'
import { startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from 'date-fns'
import { TrendingUp, TrendingDown, Scale, Download, FileText, FileJson, Receipt, FileSpreadsheet } from 'lucide-react'

type RangeKey = 'this_month' | 'last_month' | 'this_quarter' | 'this_year'

function getRange(key: RangeKey, now = new Date()) {
  switch (key) {
    case 'last_month': { const m = subMonths(now, 1); return { start: startOfMonth(m), end: endOfMonth(m), label: 'Last month' } }
    case 'this_quarter': return { start: startOfQuarter(now), end: endOfQuarter(now), label: 'This quarter' }
    case 'this_year': return { start: startOfYear(now), end: endOfYear(now), label: 'This year' }
    default: return { start: startOfMonth(now), end: endOfMonth(now), label: 'This month' }
  }
}

export function Reports() {
  const company = useCompany()
  const transactions = useTransactions()
  const invoices = useInvoices()
  const customers = useCustomers()
  const vendors = useVendors()
  const events = useEvents()
  const cur = company?.currency ?? 'INR'
  const [rangeKey, setRangeKey] = useState<RangeKey>('this_month')
  const range = useMemo(() => getRange(rangeKey), [rangeKey])
  const gst = useMemo(() => gstSummary(transactions, range), [transactions, range])

  const inRange = (date: string) => { const d = safeDate(date); return d && isWithinInterval(d, range) }

  const revenue = transactions.filter((t) => t.type === 'income' && !t.deleted_at && inRange(t.date)).reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter((t) => t.type === 'expense' && !t.deleted_at && inRange(t.date)).reduce((s, t) => s + t.amount, 0)
  const net = revenue - expenses

  const cashFlow = useMemo(() => cashFlowByMonth(transactions, 6), [transactions])
  const expenseCats = useMemo(() => categoryTotals(transactions, 'expense', range).map((c) => ({ label: c.category, value: c.total })), [transactions, range])
  const incomeCats = useMemo(() => categoryTotals(transactions, 'income', range).map((c) => ({ label: c.category, value: c.total })), [transactions, range])

  const customerRevenue = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.type === 'income' && !t.deleted_at && t.customer_id && inRange(t.date)) map.set(t.customer_id, (map.get(t.customer_id) ?? 0) + t.amount)
    }
    return Array.from(map.entries()).map(([id, v]) => ({ name: customers.find((c) => c.id === id)?.name ?? '—', value: v })).sort((a, b) => b.value - a.value).slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, customers, range])

  const vendorExpense = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.type === 'expense' && !t.deleted_at && t.vendor_id && inRange(t.date)) map.set(t.vendor_id, (map.get(t.vendor_id) ?? 0) + t.amount)
    }
    return Array.from(map.entries()).map(([id, v]) => ({ name: vendors.find((x) => x.id === id)?.name ?? '—', value: v })).sort((a, b) => b.value - a.value).slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, vendors, range])

  const rec = receivablesSummary(invoices)
  const pay = payablesFromTransactions(transactions.filter((t) => !t.deleted_at))
  const agingRows = (['current', '1-30', '31-60', '61-90', '90+'] as const).map((b) => ({
    bucket: b,
    amount: openInvoices(invoices).filter((i) => agingBucket(i.due_date) === b).reduce((s, i) => s + invoiceOutstanding(i), 0),
  }))

  const exportPDF = () => {
    if (!company) return
    ExportService.exportSummaryPDF({
      company,
      metrics: [
        { label: `Revenue (${range.label})`, value: formatMoney(revenue, cur) },
        { label: `Expenses (${range.label})`, value: formatMoney(expenses, cur) },
        { label: `Net (${range.label})`, value: formatMoney(net, cur) },
        { label: 'Total receivables', value: formatMoney(rec.totalOutstanding, cur) },
        { label: 'Total payables', value: formatMoney(pay.totalPayable, cur) },
      ],
      topCustomers: customerRevenue.map((c) => ({ name: c.name, value: formatMoney(c.value, cur) })),
      categorySpend: expenseCats.map((c) => ({ name: c.label, value: formatMoney(c.value, cur) })),
    })
    toast('success', 'Summary PDF downloaded.')
  }

  const exportJSON = async () => {
    const pkg = await BackupService.build()
    ExportService.exportJSON(pkg.data, 'finsutra-report')
    toast('success', 'Data exported as JSON.')
  }

  const inRangeTxns = useMemo(() => transactions.filter((t) => !t.deleted_at && inRange(t.date)), [transactions, range])

  const downloadPnL = () => {
    if (!company) return
    ExportService.exportPnLPDF({
      company, periodLabel: range.label,
      revenue: incomeCats.map((c) => ({ name: c.label, value: c.value })),
      expenses: expenseCats.map((c) => ({ name: c.label, value: c.value })),
      revenueTotal: revenue, expenseTotal: expenses,
    })
    toast('success', 'P&L statement downloaded.')
  }
  const exportLedger = (gstOnly: boolean) => {
    ExportService.exportLedgerCSV(inRangeTxns, { customers, vendors, events }, { gstOnly, label: gstOnly ? 'finsutra-gst-entries' : 'finsutra-ledger' })
    toast('success', gstOnly ? 'GST entries exported.' : 'Ledger exported.')
  }
  const downloadGstPdf = () => {
    if (!company) return
    ExportService.exportGstPDF({ company, periodLabel: range.label, summary: gst })
    toast('success', 'GST summary downloaded.')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Understand where your money comes from and goes"
        actions={
          <>
            <button onClick={() => ExportService.exportTransactionsCSV(transactions, customers, vendors)} className="btn-secondary"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={exportJSON} className="btn-secondary"><FileJson className="h-4 w-4" /> JSON</button>
            <button onClick={exportPDF} className="btn-primary"><FileText className="h-4 w-4" /> PDF</button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {([['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['this_year', 'This year']] as [RangeKey, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setRangeKey(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${rangeKey === k ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 border border-ink-200 hover:bg-ink-50'}`}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={`Revenue · ${range.label}`} value={formatMoney(revenue, cur)} icon={<TrendingUp className="h-4 w-4" />} tone="green" />
        <StatCard label={`Expenses · ${range.label}`} value={formatMoney(expenses, cur)} icon={<TrendingDown className="h-4 w-4" />} tone="red" />
        <StatCard label={`Net Movement · ${range.label}`} value={formatMoney(net, cur, { sign: true })} icon={<Scale className="h-4 w-4" />} tone={net >= 0 ? 'green' : 'red'} />
      </div>

      {/* Accountant Pack */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FileSpreadsheet className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-semibold text-ink-900">Accountant Pack</h2>
            <p className="text-sm text-ink-500">{range.label} · P&amp;L and GST filing, ready to share</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={downloadPnL} className="btn-primary"><FileText className="h-4 w-4" /> P&amp;L statement (PDF)</button>
          <button onClick={() => exportLedger(false)} className="btn-secondary"><Download className="h-4 w-4" /> Full ledger (CSV)</button>
        </div>

        <div className="mt-4 rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800"><Receipt className="h-4 w-4" /> GST · {range.label}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-ink-400">Output GST (sales)</p>
              <p className="mt-1 text-lg font-bold text-ink-900 tnum">{formatMoney(gst.outputGst, cur)}</p>
              <p className="text-[11px] text-ink-400">on {formatMoney(gst.outputTaxable, cur)} · {gst.outputCount} entr{gst.outputCount === 1 ? 'y' : 'ies'}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-ink-400">Input GST (purchases)</p>
              <p className="mt-1 text-lg font-bold text-ink-900 tnum">{formatMoney(gst.inputGst, cur)}</p>
              <p className="text-[11px] text-ink-400">on {formatMoney(gst.inputTaxable, cur)} · {gst.inputCount} entr{gst.inputCount === 1 ? 'y' : 'ies'}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-ink-400">Net GST payable</p>
              <p className={`mt-1 text-lg font-bold tnum ${gst.netGst >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(gst.netGst, cur)}</p>
              <p className="text-[11px] text-ink-400">output − input</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={downloadGstPdf} className="btn-secondary"><FileText className="h-4 w-4" /> GST summary (PDF)</button>
            <button onClick={() => exportLedger(true)} className="btn-secondary"><Download className="h-4 w-4" /> GST entries only (CSV)</button>
          </div>
          <p className="mt-2 text-xs text-ink-400">Share the GST-only CSV + your Drive evidence folder with your accountant for filing.</p>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-900">Cash Flow · last 6 months</h2>
        <CashFlowChart data={cashFlow} currency={cur} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Expense Categories</h2>
          <DonutChart data={expenseCats} currency={cur} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Income Categories</h2>
          <DonutChart data={incomeCats} currency={cur} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BarList title="Customer Revenue" rows={customerRevenue} cur={cur} tone="#059669" />
        <BarList title="Vendor Expenses" rows={vendorExpense} cur={cur} tone="#e11d48" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Receivables Aging</h2>
          <div className="space-y-2.5">
            {agingRows.map((r) => (
              <div key={r.bucket} className="flex items-center gap-3">
                <span className="w-24 text-sm text-ink-500">{r.bucket === 'current' ? 'Current' : `${r.bucket} days`}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${rec.totalOutstanding ? (r.amount / rec.totalOutstanding) * 100 : 0}%` }} />
                </div>
                <span className="w-24 text-right text-sm font-semibold text-ink-800 tnum">{formatMoney(r.amount, cur)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Payables Summary</h2>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Total payable" value={formatMoney(pay.totalPayable, cur)} />
            <MiniStat label="Overdue" value={formatMoney(pay.overdue, cur)} tone="text-rose-600" />
            <MiniStat label="Due this week" value={formatMoney(pay.dueThisWeek, cur)} tone="text-amber-600" />
            <MiniStat label="Upcoming" value={formatMoney(pay.upcoming, cur)} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function BarList({ title, rows, cur, tone }: { title: string; rows: { name: string; value: number }[]; cur: string; tone: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-base font-semibold text-ink-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">No data in this range</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate text-ink-700">{r.name}</span>
                <span className="font-semibold text-ink-900 tnum">{formatMoneyCompact(r.value, cur)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: tone }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={`mt-1 text-sm font-bold tnum ${tone ?? 'text-ink-900'}`}>{value}</p>
    </div>
  )
}
