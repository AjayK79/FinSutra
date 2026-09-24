import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useCompany, useCustomers, useInvoices, useInvoiceItems, useInvoice } from '@/state/hooks'
import { computeInvoiceTotals } from '@/lib/calc'
import { formatMoney, toDateInput, todayISO } from '@/lib/format'
import { PageHeader } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/primitives'
import { Field, TextField, TextArea, Combo } from '@/components/ui/Field'
import { createInvoice, updateInvoice, nextInvoiceNumber, createCustomer, type InvoiceItemInput } from '@/db/repo'
import { AIExtractionService } from '@/services/AIExtractionService'
import { toast } from '@/state/store'
import { addDays, format } from 'date-fns'
import { Plus, Trash2, Sparkles, ChevronLeft } from 'lucide-react'

interface Row extends InvoiceItemInput {
  key: string
}

const emptyRow = (): Row => ({ key: Math.random().toString(36).slice(2), description: '', quantity: 1, unit_price: 0, tax_rate: 18, discount: 0 })

export function CreateInvoice() {
  const { id: editId } = useParams()
  const company = useCompany()
  const customers = useCustomers()
  const invoices = useInvoices()
  const navigate = useNavigate()
  const location = useLocation()
  const editing = useInvoice(editId)
  const editingItems = useInvoiceItems(editId)
  const cur = company?.currency ?? 'INR'

  const [customerId, setCustomerId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [issueDate, setIssueDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [notes, setNotes] = useState('Thank you for your business.')
  const [instructions, setInstructions] = useState('')
  const [aiText, setAiText] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  // Initialise number for new invoices
  useEffect(() => {
    if (editId) return
    if (company && !invoiceNumber) {
      nextInvoiceNumber(company.id).then(setInvoiceNumber)
    }
  }, [company, editId, invoiceNumber])

  // Load editing invoice
  useEffect(() => {
    if (editId && editing && editingItems.length && !ready) {
      setCustomerId(editing.customer_id)
      setInvoiceNumber(editing.invoice_number)
      setIssueDate(toDateInput(editing.issue_date))
      setDueDate(toDateInput(editing.due_date))
      setNotes(editing.notes ?? '')
      setInstructions(editing.payment_instructions ?? '')
      setRows(editingItems.map((it) => ({ key: it.id, description: it.description, quantity: it.quantity, unit_price: it.unit_price, tax_rate: it.tax_rate, discount: it.discount })))
      setReady(true)
    }
  }, [editId, editing, editingItems, ready])

  // Prefill from AI record hand-off
  useEffect(() => {
    const prefill = (location.state as any)?.prefill
    if (!prefill || editId || ready) return
    ;(async () => {
      let cid = customers.find((c) => c.name.toLowerCase() === (prefill.customerName ?? '').toLowerCase())?.id
      if (!cid && prefill.customerName && company) {
        const c = await createCustomer({ company_id: company.id, name: prefill.customerName })
        cid = c.id
      }
      if (cid) setCustomerId(cid)
      if (prefill.amount) setRows([{ ...emptyRow(), description: prefill.description || 'Services', unit_price: prefill.amount, tax_rate: 0 }])
      if (prefill.due_in_days) setDueDate(format(addDays(new Date(), prefill.due_in_days), 'yyyy-MM-dd'))
      setReady(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, company, customers.length])

  const totals = useMemo(() => computeInvoiceTotals(rows.map((r) => ({ ...r, id: r.key, invoice_id: '', line_total: 0 }))), [rows])

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const removeRow = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))

  const runAI = () => {
    if (!aiText.trim()) return
    const ex = AIExtractionService.extractFromText(aiText)
    if (ex.party) {
      const match = customers.find((c) => c.name.toLowerCase().includes(ex.party!.toLowerCase()))
      if (match) setCustomerId(match.id)
      else if (company) createCustomer({ company_id: company.id, name: ex.party }).then((c) => setCustomerId(c.id))
    }
    if (ex.amount) setRows([{ ...emptyRow(), description: ex.description || 'Services', unit_price: ex.amount, tax_rate: 0 }])
    if (ex.due_in_days) setDueDate(format(addDays(new Date(), ex.due_in_days), 'yyyy-MM-dd'))
    toast('info', 'Draft generated — review every field before creating.')
    setAiText('')
  }

  const validate = (): string | null => {
    if (!customerId) return 'Please choose a customer.'
    if (!invoiceNumber.trim()) return 'Invoice number is required.'
    const dupe = invoices.find((i) => i.invoice_number.toLowerCase() === invoiceNumber.trim().toLowerCase() && i.id !== editId)
    if (dupe) return `Invoice number ${invoiceNumber} already exists.`
    if (rows.every((r) => !r.description.trim() || r.unit_price <= 0)) return 'Add at least one line item with a description and rate.'
    return null
  }

  const submit = async (status: 'draft' | 'sent') => {
    const err = validate()
    if (err) return setError(err)
    setError('')
    const items = rows.filter((r) => r.description.trim() && r.unit_price > 0).map((r) => ({ description: r.description, quantity: r.quantity || 1, unit_price: r.unit_price, tax_rate: r.tax_rate || 0, discount: r.discount || 0 }))
    try {
      if (editId) {
        await updateInvoice(editId, { customer_id: customerId, invoice_number: invoiceNumber.trim(), issue_date: issueDate, due_date: dueDate, notes, payment_instructions: instructions, status }, items)
        toast('success', 'Invoice updated.')
        navigate(`/invoices/${editId}`)
      } else {
        const inv = await createInvoice({ company_id: company!.id, invoice_number: invoiceNumber.trim(), customer_id: customerId, issue_date: issueDate, due_date: dueDate, notes, payment_instructions: instructions, status }, items)
        toast('success', status === 'draft' ? 'Draft saved.' : `Invoice ${inv.invoice_number} created.`)
        navigate(`/invoices/${inv.id}`)
      }
    } catch {
      setError('Could not save the invoice. Please try again.')
    }
  }

  if (!company) return null

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button onClick={() => navigate(-1)} className="btn-ghost -ml-2"><ChevronLeft className="h-4 w-4" /> Back</button>
      <PageHeader title={editId ? `Edit ${invoiceNumber}` : 'New Invoice'} subtitle={editId ? undefined : 'Bill a customer and start tracking the receivable'} />

      {!editId && (
        <Card className="border-brand-100 bg-brand-50/40 p-4">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-800"><Sparkles className="h-4 w-4" /> Create with AI</label>
          <div className="flex gap-2">
            <input value={aiText} onChange={(e) => setAiText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runAI()} placeholder="Invoice ABC Technologies ₹2,00,000 for LMS implementation, due in 30 days" className="input flex-1" />
            <button onClick={runAI} className="btn-primary">Generate draft</button>
          </div>
          <p className="mt-2 text-xs text-ink-500">FinSutra fills in a draft you can edit. Nothing is created until you click Create Invoice.</p>
        </Card>
      )}

      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer" required>
            <Combo value={customerId} onChange={setCustomerId} options={customers.map((c) => ({ id: c.id, name: c.name }))} onCreate={async (name) => { const c = await createCustomer({ company_id: company.id, name }); setCustomerId(c.id) }} placeholder="Select customer" />
          </Field>
          <Field label="Invoice number" required>
            <TextField value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-00001" />
          </Field>
          <Field label="Invoice date"><TextField type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
          <Field label="Due date">
            <div className="flex gap-2">
              <TextField type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="flex-1" />
              <select onChange={(e) => { if (e.target.value !== '') setDueDate(format(addDays(new Date(issueDate), parseInt(e.target.value)), 'yyyy-MM-dd')) }} value="" className="input w-auto">
                <option value="">Net…</option>
                <option value="0">0</option>
                <option value="7">7</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
                <option value="60">60</option>
              </select>
            </div>
          </Field>
        </div>
      </Card>

      {/* Line items */}
      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-3 text-sm font-semibold text-ink-800">Line Items</div>
        <div className="hidden grid-cols-[1fr_70px_110px_80px_80px_110px_36px] gap-2 border-b border-ink-100 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
          <span>Description</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Disc %</span><span className="text-right">Tax %</span><span className="text-right">Amount</span><span />
        </div>
        <div className="divide-y divide-ink-50">
          {rows.map((r) => {
            const line = r.quantity * r.unit_price * (1 - (r.discount || 0) / 100)
            return (
              <div key={r.key} className="grid grid-cols-2 gap-2 px-5 py-3 sm:grid-cols-[1fr_70px_110px_80px_80px_110px_36px] sm:items-center">
                <input value={r.description} onChange={(e) => updateRow(r.key, { description: e.target.value })} placeholder="Item / service" className="input col-span-2 sm:col-span-1" />
                <input type="number" min={0} value={r.quantity} onChange={(e) => updateRow(r.key, { quantity: parseFloat(e.target.value) || 0 })} className="input text-right tnum" placeholder="Qty" />
                <input type="number" min={0} value={r.unit_price || ''} onChange={(e) => updateRow(r.key, { unit_price: parseFloat(e.target.value) || 0 })} className="input text-right tnum" placeholder="Rate" />
                <input type="number" min={0} max={100} value={r.discount || ''} onChange={(e) => updateRow(r.key, { discount: parseFloat(e.target.value) || 0 })} className="input text-right tnum" placeholder="0" />
                <input type="number" min={0} max={100} value={r.tax_rate || ''} onChange={(e) => updateRow(r.key, { tax_rate: parseFloat(e.target.value) || 0 })} className="input text-right tnum" placeholder="0" />
                <div className="flex items-center justify-end text-sm font-semibold text-ink-800 tnum">{formatMoney(line, cur)}</div>
                <button onClick={() => removeRow(r.key)} className="flex items-center justify-end text-ink-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
        </div>
        <div className="px-5 py-3">
          <button onClick={() => setRows((rs) => [...rs, emptyRow()])} className="text-sm font-medium text-brand-600 hover:underline"><Plus className="inline h-4 w-4" /> Add line item</button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes shown on the invoice" /></Field>
          <Field label="Payment instructions"><TextArea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Bank / UPI details for payment" /></Field>
        </Card>
        <Card className="p-5">
          <div className="space-y-2.5">
            <TotalRow label="Subtotal" value={formatMoney(totals.subtotal, cur)} />
            {totals.discount > 0 && <TotalRow label="Discount" value={`- ${formatMoney(totals.discount, cur)}`} />}
            <TotalRow label="Tax" value={formatMoney(totals.tax, cur)} />
            <div className="my-2 h-px bg-ink-100" />
            <TotalRow label="Total" value={formatMoney(totals.total, cur)} big />
          </div>
        </Card>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

      <div className="sticky bottom-0 flex gap-2 rounded-2xl border border-ink-200 bg-white/90 p-3 shadow-soft backdrop-blur-md">
        <button onClick={() => submit('draft')} className="btn-secondary flex-1">Save as Draft</button>
        <button onClick={() => submit('sent')} className="btn-primary flex-1">{editId ? 'Save Invoice' : 'Create Invoice'}</button>
      </div>
    </div>
  )
}

function TotalRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={big ? 'text-base font-semibold text-ink-900' : 'text-sm text-ink-500'}>{label}</span>
      <span className={big ? 'text-xl font-bold text-ink-900 tnum' : 'text-sm font-medium text-ink-800 tnum'}>{value}</span>
    </div>
  )
}
