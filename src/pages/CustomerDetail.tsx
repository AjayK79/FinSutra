import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompany, useCustomers, useInvoices, usePayments, useTransactions } from '@/state/hooks'
import { customerTotals, invoiceOutstanding, deriveInvoiceStatus } from '@/lib/calc'
import { formatMoney, formatDate } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui/StatCard'
import { Card, Tabs, EmptyState, Avatar, InvoiceStatusBadge } from '@/components/ui/primitives'
import { PartyFormModal } from '@/components/PartyFormModal'
import { useApp, toast } from '@/state/store'
import { deleteCustomer } from '@/db/repo'
import { ChevronLeft, Pencil, Plus, Mail, Phone, MapPin, Trash2, FileText, HandCoins, ArrowLeftRight } from 'lucide-react'

type Tab = 'invoices' | 'payments' | 'transactions'

export function CustomerDetail() {
  const { id } = useParams()
  const company = useCompany()
  const customers = useCustomers()
  const invoices = useInvoices().filter((i) => i.customer_id === id)
  const payments = usePayments().filter((p) => p.customer_id === id).sort((a, b) => (a.date < b.date ? 1 : -1))
  const transactions = useTransactions().filter((t) => t.customer_id === id)
  const navigate = useNavigate()
  const askConfirm = useApp((s) => s.askConfirm)
  const [tab, setTab] = useState<Tab>('invoices')
  const [editOpen, setEditOpen] = useState(false)
  const cur = company?.currency ?? 'INR'

  const customer = customers.find((c) => c.id === id)
  if (!company) return null
  if (!customer) return <EmptyState title="Customer not found" action={<button onClick={() => navigate('/customers')} className="btn-primary">Back</button>} />

  const totals = customerTotals(customer.id, invoices, payments)

  const del = async () => {
    const ok = await askConfirm({ title: 'Delete customer?', body: `${customer.name} will be removed. Their invoices and transactions stay in your ledger.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await deleteCustomer(customer.id)
    toast('success', 'Customer deleted.')
    navigate('/customers')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button onClick={() => navigate('/customers')} className="btn-ghost -ml-2"><ChevronLeft className="h-4 w-4" /> Customers</button>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={customer.name} className="h-14 w-14 text-lg" />
            <div>
              <h1 className="text-xl font-bold text-ink-900">{customer.name}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
                {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
                {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>}
                {customer.gstin && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {customer.gstin}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditOpen(true)} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</button>
            <button onClick={() => navigate('/invoices/new', { state: { prefill: { customerName: customer.name } } })} className="btn-primary"><Plus className="h-4 w-4" /> Invoice</button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Billed" value={formatMoney(totals.totalBilled, cur)} tone="neutral" />
        <StatCard label="Received" value={formatMoney(totals.totalReceived, cur)} tone="green" />
        <StatCard label="Outstanding" value={formatMoney(totals.outstanding, cur)} tone="red" />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'invoices', label: 'Invoices', count: invoices.length },
        { key: 'payments', label: 'Payments', count: payments.length },
        { key: 'transactions', label: 'History', count: transactions.length },
      ]} />

      {tab === 'invoices' && (
        invoices.length === 0 ? <EmptyState icon={<FileText className="h-5 w-5" />} title="No invoices yet" /> : (
          <Card className="divide-y divide-ink-50">
            {invoices.map((i) => (
              <button key={i.id} onClick={() => navigate(`/invoices/${i.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50/60">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600"><FileText className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink-800">{i.invoice_number}</p><p className="text-xs text-ink-400">Due {formatDate(i.due_date)}</p></div>
                <div className="text-right"><p className="text-sm font-semibold text-ink-900 tnum">{formatMoney(invoiceOutstanding(i), cur)}</p><InvoiceStatusBadge status={deriveInvoiceStatus(i)} /></div>
              </button>
            ))}
          </Card>
        )
      )}

      {tab === 'payments' && (
        payments.length === 0 ? <EmptyState icon={<HandCoins className="h-5 w-5" />} title="No payments yet" /> : (
          <Card className="divide-y divide-ink-50">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><HandCoins className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink-800">{formatMoney(p.amount, cur)} · {p.payment_method}</p><p className="text-xs text-ink-400">{formatDate(p.date)} {p.reference_number ? `· ${p.reference_number}` : ''}</p></div>
              </div>
            ))}
          </Card>
        )
      )}

      {tab === 'transactions' && (
        transactions.length === 0 ? <EmptyState icon={<ArrowLeftRight className="h-5 w-5" />} title="No transactions yet" /> : (
          <Card className="divide-y divide-ink-50">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-800">{t.description}</p><p className="text-xs text-ink-400">{t.category} · {formatDate(t.date)}</p></div>
                <span className={`text-sm font-semibold tnum ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, cur)}</span>
              </div>
            ))}
          </Card>
        )
      )}

      <div className="flex justify-end">
        <button onClick={del} className="btn-ghost text-rose-600"><Trash2 className="h-4 w-4" /> Delete customer</button>
      </div>

      <PartyFormModal open={editOpen} onClose={() => setEditOpen(false)} kind="customer" companyId={company.id} existing={customer} />
    </div>
  )
}
