import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompany, useEvent, useTransactions, useCustomers, useVendors } from '@/state/hooks'
import { eventTotals } from '@/lib/calc'
import { formatMoney, formatDate } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui/StatCard'
import { Card, EmptyState, Badge, ProgressBar } from '@/components/ui/primitives'
import { EventFormModal } from '@/components/EventFormModal'
import { useApp, toast } from '@/state/store'
import { deleteEvent } from '@/db/repo'
import { ChevronLeft, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, PartyPopper } from 'lucide-react'

export function EventDetail() {
  const { id } = useParams()
  const company = useCompany()
  const event = useEvent(id)
  const transactions = useTransactions().filter((t) => t.event_id === id)
  const customers = useCustomers()
  const vendors = useVendors()
  const navigate = useNavigate()
  const askConfirm = useApp((s) => s.askConfirm)
  const [editOpen, setEditOpen] = useState(false)
  const cur = company?.currency ?? 'INR'

  if (event === undefined) return <div className="py-20 text-center text-ink-400">Loading…</div>
  if (!company || event === null) return <EmptyState title="Event not found" action={<button onClick={() => navigate('/events')} className="btn-primary">Back</button>} />

  const totals = eventTotals(event.id, transactions)
  const client = customers.find((c) => c.id === event.customer_id)
  const partyName = (t: (typeof transactions)[number]) =>
    customers.find((c) => c.id === t.customer_id)?.name ?? vendors.find((v) => v.id === t.vendor_id)?.name ?? '—'

  const del = async () => {
    const ok = await askConfirm({ title: 'Delete event?', body: `${event.name} will be removed. The payments stay in your ledger but lose their event tag.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await deleteEvent(event.id)
    toast('success', 'Event deleted.')
    navigate('/events')
  }

  const expectedPct = event.expected_amount ? Math.min(100, (totals.received / event.expected_amount) * 100) : 0

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button onClick={() => navigate('/events')} className="btn-ghost -ml-2"><ChevronLeft className="h-4 w-4" /> Events</button>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><PartyPopper className="h-6 w-6" /></div>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-ink-900">{event.name} <Badge tone={event.status === 'completed' ? 'neutral' : 'violet'}>{event.status === 'completed' ? 'Completed' : 'Active'}</Badge></h1>
              <p className="mt-1 text-sm text-ink-500">{client?.name || 'No client'} · {formatDate(event.event_date)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditOpen(true)} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Received" value={formatMoney(totals.received, cur)} tone="green" icon={<ArrowDownLeft className="h-4 w-4" />} />
        <StatCard label="Spent" value={formatMoney(totals.spent, cur)} tone="red" icon={<ArrowUpRight className="h-4 w-4" />} />
        <StatCard label="Profit" value={formatMoney(totals.profit, cur, { sign: true })} tone={totals.profit >= 0 ? 'blue' : 'amber'} />
      </div>

      {event.expected_amount ? (
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-ink-500">Collected vs expected</span>
            <span className="font-semibold text-ink-800 tnum">{formatMoney(totals.received, cur)} / {formatMoney(event.expected_amount, cur)}</span>
          </div>
          <ProgressBar value={expectedPct} tone={expectedPct >= 100 ? 'green' : 'brand'} />
          <p className="mt-2 text-xs text-ink-400">{event.expected_amount - totals.received > 0 ? `${formatMoney(event.expected_amount - totals.received, cur)} still to collect` : 'Fully collected 🎉'}</p>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-3 text-sm font-semibold text-ink-800">Transactions ({transactions.length})</div>
        {transactions.length === 0 ? (
          <div className="p-6"><EmptyState title="No payments tagged yet" body="Record a payment and pick this event to see it here." /></div>
        ) : (
          <div className="divide-y divide-ink-50">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{t.description}</p>
                  <p className="truncate text-xs text-ink-400">{partyName(t)} · {t.category} · {formatDate(t.date)}</p>
                </div>
                <span className={`text-sm font-semibold tnum ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, cur)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <button onClick={del} className="btn-ghost text-rose-600"><Trash2 className="h-4 w-4" /> Delete event</button>
      </div>

      <EventFormModal open={editOpen} onClose={() => setEditOpen(false)} companyId={company.id} existing={event} />
    </div>
  )
}
