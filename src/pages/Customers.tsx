import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany, useCustomers, useInvoices, usePayments } from '@/state/hooks'
import { customerTotals } from '@/lib/calc'
import { formatMoney } from '@/lib/format'
import { PageHeader } from '@/components/ui/StatCard'
import { Card, EmptyState, Avatar, Badge } from '@/components/ui/primitives'
import { PartyFormModal } from '@/components/PartyFormModal'
import { Plus, Search, Users } from 'lucide-react'

export function Customers() {
  const company = useCompany()
  const customers = useCustomers()
  const invoices = useInvoices()
  const payments = usePayments()
  const navigate = useNavigate()
  const cur = company?.currency ?? 'INR'
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const rows = useMemo(
    () =>
      customers
        .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || (c.email ?? '').toLowerCase().includes(q.toLowerCase()))
        .map((c) => ({ c, totals: customerTotals(c.id, invoices, payments) })),
    [customers, invoices, payments, q],
  )

  if (!company) return null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? '' : 's'}`}
        actions={<button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New Customer</button>}
      />

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" className="input pl-9" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No customers yet" body="Add your first customer to start invoicing." action={<button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New Customer</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ c, totals }) => (
            <button key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="card p-4 text-left transition hover:border-brand-200 hover:shadow-soft">
              <div className="flex items-center gap-3">
                <Avatar name={c.name} className="h-11 w-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{c.name}</p>
                  <p className="truncate text-xs text-ink-400">{c.email || c.phone || 'No contact'}</p>
                </div>
                {totals.outstanding > 0 ? <Badge tone="amber">Due</Badge> : <Badge tone="green">Clear</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
                <div><p className="text-[11px] text-ink-400">Billed</p><p className="text-sm font-semibold text-ink-800 tnum">{formatMoney(totals.totalBilled, cur)}</p></div>
                <div><p className="text-[11px] text-ink-400">Received</p><p className="text-sm font-semibold text-emerald-600 tnum">{formatMoney(totals.totalReceived, cur)}</p></div>
                <div><p className="text-[11px] text-ink-400">Outstanding</p><p className="text-sm font-semibold text-rose-600 tnum">{formatMoney(totals.outstanding, cur)}</p></div>
              </div>
            </button>
          ))}
        </div>
      )}

      <PartyFormModal open={addOpen} onClose={() => setAddOpen(false)} kind="customer" companyId={company.id} onSaved={(id) => navigate(`/customers/${id}`)} />
    </div>
  )
}
