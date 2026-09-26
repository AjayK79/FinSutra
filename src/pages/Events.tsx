import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany, useEvents, useTransactions, useCustomers } from '@/state/hooks'
import { eventTotals } from '@/lib/calc'
import { formatMoney, formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/StatCard'
import { Card, EmptyState, Badge } from '@/components/ui/primitives'
import { EventFormModal } from '@/components/EventFormModal'
import { Plus, Search, PartyPopper } from 'lucide-react'

export function Events() {
  const company = useCompany()
  const events = useEvents()
  const transactions = useTransactions()
  const customers = useCustomers()
  const navigate = useNavigate()
  const cur = company?.currency ?? 'INR'
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const rows = useMemo(
    () =>
      events
        .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
        .map((e) => ({ e, totals: eventTotals(e.id, transactions) })),
    [events, transactions, q],
  )

  const cName = (id?: string | null) => customers.find((c) => c.id === id)?.name

  if (!company) return null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Events"
        subtitle="Track money in, money out and profit per event"
        actions={<button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New Event</button>}
      />

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…" className="input pl-9" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<PartyPopper className="h-5 w-5" />} title="No events yet" body="Create an event, then tag payments to it to see its profit." action={<button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New Event</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ e, totals }) => (
            <button key={e.id} onClick={() => navigate(`/events/${e.id}`)} className="card p-4 text-left transition hover:border-brand-200 hover:shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{e.name}</p>
                  <p className="truncate text-xs text-ink-400">{cName(e.customer_id) || 'No client'} · {formatDate(e.event_date)}</p>
                </div>
                <Badge tone={e.status === 'completed' ? 'neutral' : 'violet'}>{e.status === 'completed' ? 'Done' : 'Active'}</Badge>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-3">
                <div>
                  <p className="text-[11px] text-ink-400">Profit</p>
                  <p className={`text-lg font-bold tnum ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(totals.profit, cur, { sign: true })}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-emerald-600 tnum">+{formatMoney(totals.received, cur)}</p>
                  <p className="text-rose-500 tnum">-{formatMoney(totals.spent, cur)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <EventFormModal open={addOpen} onClose={() => setAddOpen(false)} companyId={company.id} onSaved={(id) => navigate(`/events/${id}`)} />
    </div>
  )
}
