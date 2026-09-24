import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompany, useVendors, useTransactions, usePayments } from '@/state/hooks'
import { vendorTotals } from '@/lib/calc'
import { formatMoney, formatDate } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui/StatCard'
import { Card, Tabs, EmptyState, Avatar, Badge } from '@/components/ui/primitives'
import { PartyFormModal } from '@/components/PartyFormModal'
import { useApp, toast } from '@/state/store'
import { deleteVendor } from '@/db/repo'
import { ChevronLeft, Pencil, Mail, Phone, MapPin, Trash2, Receipt, ArrowUpRight } from 'lucide-react'

type Tab = 'bills' | 'transactions'

export function VendorDetail() {
  const { id } = useParams()
  const company = useCompany()
  const vendors = useVendors()
  const transactions = useTransactions().filter((t) => t.vendor_id === id)
  const payments = usePayments()
  const navigate = useNavigate()
  const askConfirm = useApp((s) => s.askConfirm)
  const [tab, setTab] = useState<Tab>('transactions')
  const [editOpen, setEditOpen] = useState(false)
  const cur = company?.currency ?? 'INR'

  const vendor = vendors.find((v) => v.id === id)
  if (!company) return null
  if (!vendor) return <EmptyState title="Vendor not found" action={<button onClick={() => navigate('/vendors')} className="btn-primary">Back</button>} />

  const totals = vendorTotals(vendor.id, transactions, payments)
  const bills = transactions.filter((t) => t.status === 'pending')
  const paidTxns = transactions.filter((t) => t.status !== 'pending')

  const del = async () => {
    const ok = await askConfirm({ title: 'Delete vendor?', body: `${vendor.name} will be removed. Their transactions stay in your ledger.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await deleteVendor(vendor.id)
    toast('success', 'Vendor deleted.')
    navigate('/vendors')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button onClick={() => navigate('/vendors')} className="btn-ghost -ml-2"><ChevronLeft className="h-4 w-4" /> Vendors</button>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={vendor.name} className="h-14 w-14 text-lg" />
            <div>
              <h1 className="text-xl font-bold text-ink-900">{vendor.name}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
                {vendor.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {vendor.email}</span>}
                {vendor.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {vendor.phone}</span>}
                {vendor.gstin && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {vendor.gstin}</span>}
              </div>
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Purchases" value={formatMoney(totals.totalPurchases, cur)} tone="neutral" />
        <StatCard label="Paid" value={formatMoney(totals.totalPaid, cur)} tone="green" />
        <StatCard label="Outstanding" value={formatMoney(totals.outstanding, cur)} tone="red" />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'transactions', label: 'Transactions', count: paidTxns.length },
        { key: 'bills', label: 'Bills / Payable', count: bills.length },
      ]} />

      {tab === 'bills' && (
        bills.length === 0 ? <EmptyState icon={<Receipt className="h-5 w-5" />} title="No open bills" /> : (
          <Card className="divide-y divide-ink-50">
            {bills.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-800">{t.description}</p><p className="text-xs text-ink-400">Due {formatDate(t.date)}</p></div>
                <Badge tone="amber">Payable</Badge>
                <span className="text-sm font-semibold text-rose-600 tnum">{formatMoney(t.amount, cur)}</span>
              </div>
            ))}
          </Card>
        )
      )}

      {tab === 'transactions' && (
        paidTxns.length === 0 ? <EmptyState icon={<ArrowUpRight className="h-5 w-5" />} title="No transactions yet" /> : (
          <Card className="divide-y divide-ink-50">
            {paidTxns.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600"><ArrowUpRight className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-800">{t.description}</p><p className="text-xs text-ink-400">{t.category} · {formatDate(t.date)}</p></div>
                <span className="text-sm font-semibold text-rose-600 tnum">-{formatMoney(t.amount, cur)}</span>
              </div>
            ))}
          </Card>
        )
      )}

      <div className="flex justify-end">
        <button onClick={del} className="btn-ghost text-rose-600"><Trash2 className="h-4 w-4" /> Delete vendor</button>
      </div>

      <PartyFormModal open={editOpen} onClose={() => setEditOpen(false)} kind="vendor" companyId={company.id} existing={vendor} />
    </div>
  )
}
