import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany, useVendors, useTransactions, usePayments } from '@/state/hooks'
import { vendorTotals } from '@/lib/calc'
import { formatMoney } from '@/lib/format'
import { PageHeader } from '@/components/ui/StatCard'
import { Card, EmptyState, Avatar, Badge } from '@/components/ui/primitives'
import { PartyFormModal } from '@/components/PartyFormModal'
import { Plus, Search, Truck } from 'lucide-react'

export function Vendors() {
  const company = useCompany()
  const vendors = useVendors()
  const transactions = useTransactions()
  const payments = usePayments()
  const navigate = useNavigate()
  const cur = company?.currency ?? 'INR'
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const rows = useMemo(
    () =>
      vendors
        .filter((v) => v.name.toLowerCase().includes(q.toLowerCase()) || (v.email ?? '').toLowerCase().includes(q.toLowerCase()))
        .map((v) => ({ v, totals: vendorTotals(v.id, transactions, payments) })),
    [vendors, transactions, payments, q],
  )

  if (!company) return null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} vendor${vendors.length === 1 ? '' : 's'}`}
        actions={<button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New Vendor</button>}
      />

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors…" className="input pl-9" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Truck className="h-5 w-5" />} title="No vendors yet" body="Add vendors to track your expenses and payables." action={<button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New Vendor</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ v, totals }) => (
            <button key={v.id} onClick={() => navigate(`/vendors/${v.id}`)} className="card p-4 text-left transition hover:border-brand-200 hover:shadow-soft">
              <div className="flex items-center gap-3">
                <Avatar name={v.name} className="h-11 w-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{v.name}</p>
                  <p className="truncate text-xs text-ink-400">{v.email || v.phone || 'No contact'}</p>
                </div>
                {totals.outstanding > 0 ? <Badge tone="amber">Owe</Badge> : <Badge tone="green">Clear</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
                <div><p className="text-[11px] text-ink-400">Purchases</p><p className="text-sm font-semibold text-ink-800 tnum">{formatMoney(totals.totalPurchases, cur)}</p></div>
                <div><p className="text-[11px] text-ink-400">Paid</p><p className="text-sm font-semibold text-emerald-600 tnum">{formatMoney(totals.totalPaid, cur)}</p></div>
                <div><p className="text-[11px] text-ink-400">Payable</p><p className="text-sm font-semibold text-rose-600 tnum">{formatMoney(totals.outstanding, cur)}</p></div>
              </div>
            </button>
          ))}
        </div>
      )}

      <PartyFormModal open={addOpen} onClose={() => setAddOpen(false)} kind="vendor" companyId={company.id} onSaved={(id) => navigate(`/vendors/${id}`)} />
    </div>
  )
}
