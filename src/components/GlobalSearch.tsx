import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { useApp } from '@/state/store'
import { useTransactions, useCustomers, useVendors, useInvoices, useDocuments } from '@/state/hooks'
import { Search, Users, Truck, FileText, ArrowLeftRight, FolderOpen } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { InvoiceStatusBadge } from '@/components/ui/primitives'

export function GlobalSearch() {
  const open = useApp((s) => s.searchOpen)
  const setOpen = useApp((s) => s.setSearchOpen)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  const transactions = useTransactions()
  const customers = useCustomers()
  const vendors = useVendors()
  const invoices = useInvoices()
  const documents = useDocuments()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return null
    const cn = (id?: string | null) => customers.find((c) => c.id === id)?.name ?? vendors.find((v) => v.id === id)?.name ?? ''
    return {
      customers: customers.filter((c) => c.name.toLowerCase().includes(query) || c.email?.toLowerCase().includes(query)).slice(0, 5),
      vendors: vendors.filter((v) => v.name.toLowerCase().includes(query) || v.email?.toLowerCase().includes(query)).slice(0, 5),
      invoices: invoices.filter((i) => i.invoice_number.toLowerCase().includes(query) || cn(i.customer_id).toLowerCase().includes(query)).slice(0, 6),
      transactions: transactions
        .filter((t) => t.description.toLowerCase().includes(query) || t.category.toLowerCase().includes(query) || cn(t.customer_id || t.vendor_id).toLowerCase().includes(query) || String(t.amount).includes(query))
        .slice(0, 6),
      documents: documents.filter((d) => d.filename.toLowerCase().includes(query)).slice(0, 4),
    }
  }, [q, customers, vendors, invoices, transactions, documents])

  const nav = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  const total = results ? results.customers.length + results.vendors.length + results.invoices.length + results.transactions.length + results.documents.length : 0

  return (
    <Modal open={open} onClose={() => setOpen(false)} hideClose size="lg">
      <div className="-mx-5 -my-5 sm:-mx-6 sm:-my-5">
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-3.5">
          <Search className="h-5 w-5 text-ink-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transactions, invoices, customers, vendors, documents…"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink-400"
          />
          <kbd className="rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-400">Esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {!q.trim() && (
            <p className="px-3 py-8 text-center text-sm text-ink-400">Type to search across your whole business.</p>
          )}
          {q.trim() && total === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-400">No results for “{q}”.</p>
          )}

          {results && results.customers.length > 0 && (
            <Group label="Customers">
              {results.customers.map((c) => (
                <Row key={c.id} icon={<Users className="h-4 w-4" />} title={c.name} sub={c.email} onClick={() => nav(`/customers/${c.id}`)} />
              ))}
            </Group>
          )}
          {results && results.vendors.length > 0 && (
            <Group label="Vendors">
              {results.vendors.map((v) => (
                <Row key={v.id} icon={<Truck className="h-4 w-4" />} title={v.name} sub={v.email} onClick={() => nav(`/vendors/${v.id}`)} />
              ))}
            </Group>
          )}
          {results && results.invoices.length > 0 && (
            <Group label="Invoices">
              {results.invoices.map((i) => (
                <Row
                  key={i.id}
                  icon={<FileText className="h-4 w-4" />}
                  title={`${i.invoice_number} · ${customers.find((c) => c.id === i.customer_id)?.name ?? ''}`}
                  sub={`${formatMoney(i.total)} · due ${formatDate(i.due_date)}`}
                  right={<InvoiceStatusBadge status={i.status} />}
                  onClick={() => nav(`/invoices/${i.id}`)}
                />
              ))}
            </Group>
          )}
          {results && results.transactions.length > 0 && (
            <Group label="Transactions">
              {results.transactions.map((t) => (
                <Row
                  key={t.id}
                  icon={<ArrowLeftRight className="h-4 w-4" />}
                  title={t.description}
                  sub={`${t.category} · ${formatDate(t.date)}`}
                  right={<span className={`text-sm font-semibold tnum ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}</span>}
                  onClick={() => nav('/transactions')}
                />
              ))}
            </Group>
          )}
          {results && results.documents.length > 0 && (
            <Group label="Documents">
              {results.documents.map((d) => (
                <Row key={d.id} icon={<FolderOpen className="h-4 w-4" />} title={d.filename} sub={d.category} onClick={() => nav('/documents')} />
              ))}
            </Group>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      {children}
    </div>
  )
}

function Row({
  icon,
  title,
  sub,
  right,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  sub?: string
  right?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-ink-50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-800">{title}</p>
        {sub && <p className="truncate text-xs text-ink-400">{sub}</p>}
      </div>
      {right}
    </button>
  )
}
