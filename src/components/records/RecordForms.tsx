import { useState } from 'react'
import { Field, MoneyField, SelectField, Combo, TextField, TextArea, SegmentedControl } from '@/components/ui/Field'
import { AttachmentPicker } from './AttachmentPicker'
import { useCustomers, useVendors, useCategories, useInvoices } from '@/state/hooks'
import {
  createTransaction,
  createCustomer,
  createVendor,
  recordPayment,
} from '@/db/repo'
import { persistAttachments } from '@/lib/files'
import { toDateInput, todayISO, formatMoney } from '@/lib/format'
import { invoiceOutstanding } from '@/lib/calc'
import { toast } from '@/state/store'
import type { PaymentMethod } from '@/db/types'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

const METHODS: PaymentMethod[] = ['Cash', 'Bank', 'UPI', 'Card', 'Cheque', 'Other']
const methodOpts = METHODS.map((m) => ({ value: m, label: m }))

function SaveBar({ onSave, saving, label }: { onSave: () => void; saving: boolean; label: string }) {
  return (
    <button onClick={onSave} disabled={saving} className="btn-primary w-full">
      {saving ? 'Saving…' : label}
    </button>
  )
}

// --- Income ---------------------------------------------------------------

export function IncomeForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const customers = useCustomers()
  const categories = useCategories().filter((c) => c.type === 'income')
  const [amount, setAmount] = useState<number | ''>('')
  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [category, setCategory] = useState('Services')
  const [method, setMethod] = useState<PaymentMethod>('Bank')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (amount === '' || amount <= 0) return setError('Enter a valid amount.')
    if (!customerId) return setError('Choose who you received money from.')
    setSaving(true)
    try {
      const txn = await createTransaction({
        company_id: companyId,
        type: 'income',
        amount: amount as number,
        date,
        description: notes || `Received from ${customers.find((c) => c.id === customerId)?.name ?? 'customer'}`,
        category,
        customer_id: customerId,
        payment_method: method,
        status: 'completed',
        reference_number: ref,
        notes,
      })
      if (files.length) await persistAttachments(files, { company_id: companyId, category: 'Receipts', linked_transaction_id: txn.id, linked_customer_id: customerId })
      toast('success', `${formatMoney(amount as number, 'INR')} income recorded.`)
      onDone()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Amount received" required>
        <MoneyField value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Field label="Received from" required>
        <Combo
          value={customerId}
          onChange={setCustomerId}
          options={customers.map((c) => ({ id: c.id, name: c.name }))}
          onCreate={async (name) => { const c = await createCustomer({ company_id: companyId, name }); setCustomerId(c.id) }}
          placeholder="Select customer"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Category">
          <SelectField value={category} onChange={setCategory} options={categories.map((c) => ({ value: c.name, label: c.name }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment method"><SelectField value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={methodOpts} /></Field>
        <Field label="Reference no."><TextField value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" /></Field>
      </div>
      <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
      <AttachmentPicker files={files} onChange={setFiles} />
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <SaveBar onSave={save} saving={saving} label="Save Transaction" />
    </div>
  )
}

// --- Expense / Bill -------------------------------------------------------

export function ExpenseForm({ companyId, onDone, asBill = false }: { companyId: string; onDone: () => void; asBill?: boolean }) {
  const vendors = useVendors()
  const categories = useCategories().filter((c) => c.type === 'expense')
  const [amount, setAmount] = useState<number | ''>('')
  const [vendorId, setVendorId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [category, setCategory] = useState('Office')
  const [method, setMethod] = useState<PaymentMethod>('Bank')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [pending, setPending] = useState(asBill)
  const [dueDate, setDueDate] = useState(todayISO())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (amount === '' || amount <= 0) return setError('Enter a valid amount.')
    if (!vendorId) return setError('Choose who you paid.')
    setSaving(true)
    try {
      const txn = await createTransaction({
        company_id: companyId,
        type: 'expense',
        amount: amount as number,
        date: pending ? dueDate : date,
        description: notes || `Paid to ${vendors.find((v) => v.id === vendorId)?.name ?? 'vendor'}`,
        category,
        vendor_id: vendorId,
        payment_method: method,
        status: pending ? 'pending' : 'completed',
        reference_number: ref,
        notes,
      })
      if (files.length) await persistAttachments(files, { company_id: companyId, category: asBill ? 'Bills' : 'Receipts', linked_transaction_id: txn.id, linked_vendor_id: vendorId })
      toast('success', pending ? `${formatMoney(amount as number, 'INR')} bill recorded as payable.` : `${formatMoney(amount as number, 'INR')} expense recorded.`)
      onDone()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Amount" required>
        <MoneyField value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Field label="Paid to" required>
        <Combo
          value={vendorId}
          onChange={setVendorId}
          options={vendors.map((v) => ({ id: v.id, name: v.name }))}
          onCreate={async (name) => { const v = await createVendor({ company_id: companyId, name }); setVendorId(v.id) }}
          placeholder="Select vendor"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pending ? 'Bill date' : 'Date'}><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Category">
          <SelectField value={category} onChange={setCategory} options={categories.map((c) => ({ value: c.name, label: c.name }))} />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-ink-50/50 px-3.5 py-2.5">
        <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-brand-600" />
        <span className="text-sm text-ink-700">This is unpaid — track as a payable</span>
      </label>
      {pending && (
        <Field label="Due date"><TextField type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      )}
      {!pending && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment method"><SelectField value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={methodOpts} /></Field>
          <Field label="Reference no."><TextField value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" /></Field>
        </div>
      )}
      <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
      <AttachmentPicker files={files} onChange={setFiles} label="Attach receipt / bill" />
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <SaveBar onSave={save} saving={saving} label={pending ? 'Save Bill' : 'Save Transaction'} />
    </div>
  )
}

// --- Payment against invoice ---------------------------------------------

export function PaymentForm({
  companyId,
  onDone,
  fixedInvoiceId,
}: {
  companyId: string
  onDone: () => void
  fixedInvoiceId?: string
}) {
  const invoices = useInvoices()
  const customers = useCustomers()
  const open = invoices.filter((i) => i.status !== 'draft' && invoiceOutstanding(i) > 0.01)
  const [invoiceId, setInvoiceId] = useState(fixedInvoiceId ?? '')
  const selected = invoices.find((i) => i.id === invoiceId)
  const outstanding = selected ? invoiceOutstanding(selected) : 0
  const [amount, setAmount] = useState<number | ''>('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<PaymentMethod>('Bank')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const pickInvoice = (id: string) => {
    setInvoiceId(id)
    const inv = invoices.find((i) => i.id === id)
    if (inv) setAmount(invoiceOutstanding(inv))
  }

  const save = async () => {
    if (!invoiceId) return setError('Select an invoice.')
    if (amount === '' || amount <= 0) return setError('Enter a valid amount.')
    if ((amount as number) > outstanding + 0.01) return setError(`Amount can't exceed the outstanding ${formatMoney(outstanding, 'INR')}.`)
    setSaving(true)
    try {
      const attIds = files.length ? await persistAttachments(files, { company_id: companyId, category: 'Payment Evidence', linked_invoice_id: invoiceId }) : []
      await recordPayment({
        company_id: companyId,
        invoice_id: invoiceId,
        customer_id: selected?.customer_id,
        amount: amount as number,
        date,
        payment_method: method,
        reference_number: ref,
        notes: notes || `Payment for ${selected?.invoice_number}`,
        direction: 'in',
        attachment_ids: attIds,
        category: 'Services',
      })
      toast('success', `${formatMoney(amount as number, 'INR')} payment recorded.`)
      onDone()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Invoice" required>
        <Combo
          value={invoiceId}
          onChange={pickInvoice}
          options={open.map((i) => ({
            id: i.id,
            name: `${i.invoice_number} · ${customers.find((c) => c.id === i.customer_id)?.name ?? ''}`,
            sub: `${formatMoney(invoiceOutstanding(i), 'INR')} due`,
          }))}
          placeholder="Select an open invoice"
        />
      </Field>
      {selected && (
        <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm">
          <span className="text-ink-600">Outstanding on {selected.invoice_number}</span>
          <span className="font-bold text-brand-700 tnum">{formatMoney(outstanding, 'INR')}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount received" required><MoneyField value={amount} onChange={setAmount} /></Field>
        <Field label="Date"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment method"><SelectField value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={methodOpts} /></Field>
        <Field label="Reference no."><TextField value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" /></Field>
      </div>
      <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
      <AttachmentPicker files={files} onChange={setFiles} label="Attach payment evidence" />
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <SaveBar onSave={save} saving={saving} label="Record Payment" />
    </div>
  )
}

// --- Transfer -------------------------------------------------------------

export function TransferForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const [amount, setAmount] = useState<number | ''>('')
  const [from, setFrom] = useState('Bank')
  const [to, setTo] = useState('Cash')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (amount === '' || amount <= 0) return setError('Enter a valid amount.')
    if (from === to) return setError('Source and destination must differ.')
    setSaving(true)
    try {
      await createTransaction({
        company_id: companyId,
        type: 'transfer',
        amount: amount as number,
        date,
        description: `Transfer ${from} → ${to}`,
        category: 'Transfer',
        payment_method: from as PaymentMethod,
        transfer_to: to,
        status: 'completed',
        notes,
      })
      toast('success', `${formatMoney(amount as number, 'INR')} transfer recorded.`)
      onDone()
    } catch {
      setError('Something went wrong.')
      setSaving(false)
    }
  }

  const opts = METHODS.map((m) => ({ value: m, label: m }))
  return (
    <div className="space-y-4">
      <Field label="Amount" required><MoneyField value={amount} onChange={setAmount} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><SelectField value={from} onChange={setFrom} options={opts} /></Field>
        <Field label="To"><SelectField value={to} onChange={setTo} options={opts} /></Field>
      </div>
      <Field label="Date"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <SaveBar onSave={save} saving={saving} label="Record Transfer" />
    </div>
  )
}
