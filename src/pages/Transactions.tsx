import { useMemo, useState } from 'react'
import { useCompany, useTransactions, useCustomers, useVendors, useCategories } from '@/state/hooks'
import { formatMoney, formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/StatCard'
import { Card, Tabs, EmptyState, Badge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field, TextField, SelectField, MoneyField, TextArea } from '@/components/ui/Field'
import { useApp, toast } from '@/state/store'
import { updateTransaction, softDeleteTransaction } from '@/db/repo'
import { Search, SlidersHorizontal, ArrowDownLeft, ArrowUpRight, HandCoins, Download, Plus, Trash2, Pencil } from 'lucide-react'
import { ExportService } from '@/services/ExportService'
import type { Transaction, PaymentMethod } from '@/db/types'

type Tab = 'all' | 'income' | 'expense' | 'transfer'
const METHODS: PaymentMethod[] = ['Cash', 'Bank', 'UPI', 'Card', 'Cheque', 'Other']

export function Transactions() {
  const company = useCompany()
  const transactions = useTransactions()
  const customers = useCustomers()
  const vendors = useVendors()
  const categories = useCategories()
  const openRecord = useApp((s) => s.openRecord)
  const cur = company?.currency ?? 'INR'

  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<Transaction | null>(null)

  const partyName = (t: Transaction) =>
    customers.find((c) => c.id === t.customer_id)?.name ?? vendors.find((v) => v.id === t.vendor_id)?.name ?? '—'

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (tab !== 'all' && t.type !== tab) return false
      if (category && t.category !== category) return false
      if (method && t.payment_method !== method) return false
      if (status && t.status !== status) return false
      if (from && t.date < from) return false
      if (to && t.date > to) return false
      if (q) {
        const hay = `${t.description} ${t.category} ${partyName(t)} ${t.reference_number ?? ''} ${t.amount}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, tab, category, method, status, from, to, q, customers, vendors])

  const totalIn = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalOut = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const counts = {
    all: transactions.length,
    income: transactions.filter((t) => t.type === 'income').length,
    expense: transactions.filter((t) => t.type === 'expense').length,
    transfer: transactions.filter((t) => t.type === 'transfer').length,
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        subtitle="Everything that happened to your money"
        actions={
          <>
            <button onClick={() => ExportService.exportTransactionsCSV(filtered, customers, vendors)} className="btn-secondary">
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button onClick={() => openRecord('menu')} className="btn-primary"><Plus className="h-4 w-4" /> Record</button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'income', label: 'Income', count: counts.income },
            { key: 'expense', label: 'Expenses', count: counts.expense },
            { key: 'transfer', label: 'Transfers', count: counts.transfer },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions…" className="input pl-9" />
          </div>
          <button onClick={() => setShowFilters((v) => !v)} className={`btn-secondary ${showFilters ? 'border-brand-300 bg-brand-50 text-brand-700' : ''}`}>
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showFilters && (
        <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          <Field label="Category"><SelectField value={category} onChange={setCategory} options={[...new Set(categories.map((c) => c.name))].map((n) => ({ value: n, label: n }))} placeholder="All" /></Field>
          <Field label="Method"><SelectField value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: m }))} placeholder="All" /></Field>
          <Field label="Status"><SelectField value={status} onChange={setStatus} options={[{ value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }]} placeholder="All" /></Field>
          <Field label="From"><TextField type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><TextField type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </Card>
      )}

      {/* Totals bar */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone="green"><ArrowDownLeft className="h-3.5 w-3.5" /> In {formatMoney(totalIn, cur)}</Badge>
        <Badge tone="red"><ArrowUpRight className="h-3.5 w-3.5" /> Out {formatMoney(totalOut, cur)}</Badge>
        <Badge tone="neutral">{filtered.length} shown</Badge>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No transactions match" body="Try adjusting your filters, or record a new transaction." action={<button onClick={() => openRecord('menu')} className="btn-primary"><Plus className="h-4 w-4" /> Record</button>} />
      ) : (
        <Card className="overflow-hidden">
          {/* desktop table */}
          <table className="hidden w-full sm:table">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Party</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => setSelected(t)} className="cursor-pointer text-sm hover:bg-ink-50/60">
                  <td className="whitespace-nowrap px-5 py-3 text-ink-500">{formatDate(t.date)}</td>
                  <td className="px-5 py-3 font-medium text-ink-800">
                    {t.description}
                    {t.status === 'pending' && <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pending</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{partyName(t)}</td>
                  <td className="px-5 py-3"><Badge tone="neutral">{t.category}</Badge></td>
                  <td className="px-5 py-3 text-ink-500">{t.payment_method}</td>
                  <td className={`whitespace-nowrap px-5 py-3 text-right font-semibold tnum ${t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-ink-700'}`}>
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatMoney(t.amount, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* mobile list */}
          <div className="divide-y divide-ink-100 sm:hidden">
            {filtered.map((t) => (
              <button key={t.id} onClick={() => setSelected(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 'bg-violet-50 text-violet-600'}`}>
                  {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : t.type === 'expense' ? <ArrowUpRight className="h-4 w-4" /> : <HandCoins className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{t.description}</p>
                  <p className="truncate text-xs text-ink-400">{partyName(t)} · {formatDate(t.date)}</p>
                </div>
                <span className={`text-sm font-semibold tnum ${t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-ink-700'}`}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatMoney(t.amount, cur)}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {selected && <TxnDetail txn={selected} onClose={() => setSelected(null)} categories={categories} partyName={partyName(selected)} cur={cur} />}
    </div>
  )
}

function TxnDetail({ txn, onClose, categories, partyName, cur }: { txn: Transaction; onClose: () => void; categories: { name: string; type: string }[]; partyName: string; cur: string }) {
  const askConfirm = useApp((s) => s.askConfirm)
  const [edit, setEdit] = useState(false)
  const [amount, setAmount] = useState<number | ''>(txn.amount)
  const [date, setDate] = useState(txn.date)
  const [category, setCategory] = useState(txn.category)
  const [description, setDescription] = useState(txn.description)
  const [notes, setNotes] = useState(txn.notes ?? '')
  const [method, setMethod] = useState<PaymentMethod>(txn.payment_method)

  const save = async () => {
    if (amount === '' || amount <= 0) return toast('error', 'Enter a valid amount.')
    await updateTransaction(txn.id, { amount: amount as number, date, category, description, notes, payment_method: method })
    toast('success', 'Transaction updated.')
    onClose()
  }

  const del = async () => {
    const ok = await askConfirm({ title: 'Delete transaction?', body: 'This will remove it from your ledger. This can be restored from a backup.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await softDeleteTransaction(txn.id)
    toast('success', 'Transaction deleted.')
    onClose()
  }

  const catOpts = [...new Set(categories.filter((c) => (txn.type === 'income' ? c.type === 'income' : c.type === 'expense')).map((c) => c.name))].map((n) => ({ value: n, label: n }))

  return (
    <Modal
      open
      onClose={onClose}
      title={edit ? 'Edit transaction' : txn.description}
      subtitle={!edit ? `${partyName} · ${formatDate(txn.date)}` : undefined}
      footer={
        edit ? (
          <div className="flex justify-end gap-2">
            <button onClick={() => setEdit(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} className="btn-primary">Save changes</button>
          </div>
        ) : (
          <div className="flex justify-between">
            <button onClick={del} className="btn-ghost text-rose-600"><Trash2 className="h-4 w-4" /> Delete</button>
            <button onClick={() => setEdit(true)} className="btn-primary"><Pencil className="h-4 w-4" /> Edit</button>
          </div>
        )
      }
    >
      {edit ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount"><MoneyField value={amount} onChange={setAmount} currency={cur} /></Field>
            <Field label="Date"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <Field label="Description"><TextField value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><SelectField value={category} onChange={setCategory} options={catOpts} /></Field>
            <Field label="Method"><SelectField value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={METHODS.map((m) => ({ value: m, label: m }))} /></Field>
          </div>
          <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-2xl p-4 text-center ${txn.type === 'income' ? 'bg-emerald-50' : txn.type === 'expense' ? 'bg-rose-50' : 'bg-violet-50'}`}>
            <p className="text-xs uppercase tracking-wide text-ink-400">{txn.type}</p>
            <p className={`text-3xl font-bold tnum ${txn.type === 'income' ? 'text-emerald-600' : txn.type === 'expense' ? 'text-rose-600' : 'text-violet-600'}`}>
              {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}{formatMoney(txn.amount, cur)}
            </p>
          </div>
          <DetailRow label="Party" value={partyName} />
          <DetailRow label="Category" value={txn.category} />
          <DetailRow label="Payment method" value={txn.payment_method} />
          <DetailRow label="Date" value={formatDate(txn.date)} />
          {txn.reference_number && <DetailRow label="Reference" value={txn.reference_number} />}
          <DetailRow label="Status" value={txn.status} />
          {txn.notes && <DetailRow label="Notes" value={txn.notes} />}
        </div>
      )}
    </Modal>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-50 py-2 text-sm last:border-0">
      <span className="text-ink-400">{label}</span>
      <span className="font-medium text-ink-800">{value}</span>
    </div>
  )
}
