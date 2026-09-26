import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompany, useInvoice, useInvoiceItems, useCustomers, usePayments } from '@/state/hooks'
import { deriveInvoiceStatus, invoiceOutstanding } from '@/lib/calc'
import { formatMoney, formatDate, relativeTime } from '@/lib/format'
import { PageHeader } from '@/components/ui/StatCard'
import { Card, InvoiceStatusBadge, EmptyState } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { PaymentForm } from '@/components/records/RecordForms'
import { ExportService } from '@/services/ExportService'
import { setInvoiceStatus, softDeleteInvoice, createInvoice, pushNotification, nextInvoiceNumber } from '@/db/repo'
import { useApp, toast } from '@/state/store'
import { openWhatsApp, reminderMessage } from '@/lib/whatsapp'
import { Download, Copy, HandCoins, Send, Bell, Pencil, ChevronLeft, Trash2, CheckCircle2, MessageCircle } from 'lucide-react'

export function InvoiceDetail() {
  const { id } = useParams()
  const company = useCompany()
  const invoice = useInvoice(id)
  const items = useInvoiceItems(id)
  const customers = useCustomers()
  const payments = usePayments().filter((p) => p.invoice_id === id).sort((a, b) => (a.date < b.date ? 1 : -1))
  const navigate = useNavigate()
  const askConfirm = useApp((s) => s.askConfirm)
  const [payOpen, setPayOpen] = useState(false)
  const cur = company?.currency ?? 'INR'

  if (invoice === undefined) return <div className="py-20 text-center text-ink-400">Loading…</div>
  if (invoice === null || !company) {
    return <EmptyState title="Invoice not found" body="It may have been deleted." action={<button onClick={() => navigate('/invoices')} className="btn-primary">Back to invoices</button>} />
  }

  const customer = customers.find((c) => c.id === invoice.customer_id)
  const status = deriveInvoiceStatus(invoice)
  const outstanding = invoiceOutstanding(invoice)

  const downloadPdf = () => {
    ExportService.generateInvoicePDF(invoice, items, customer, company)
    toast('success', 'Invoice PDF downloaded.')
  }

  const duplicate = async () => {
    const num = await nextInvoiceNumber(company.id)
    const inv = await createInvoice(
      { company_id: company.id, invoice_number: num, customer_id: invoice.customer_id, issue_date: new Date().toISOString().slice(0, 10), due_date: invoice.due_date, notes: invoice.notes, payment_instructions: invoice.payment_instructions, status: 'draft' },
      items.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price, tax_rate: it.tax_rate, discount: it.discount })),
    )
    toast('success', `Duplicated as ${inv.invoice_number} (draft).`)
    navigate(`/invoices/${inv.id}`)
  }

  const markSent = async () => {
    await setInvoiceStatus(invoice.id, 'sent')
    toast('success', 'Marked as sent.')
  }

  const sendReminder = async () => {
    await pushNotification({
      company_id: company.id,
      type: 'due_soon',
      title: `Reminder logged for ${invoice.invoice_number}`,
      body: `${customer?.name ?? 'Customer'} owes ${formatMoney(outstanding, cur)}. A reminder note was logged (FinSutra doesn't send email in this MVP).`,
      link: `/invoices/${invoice.id}`,
    })
    toast('success', 'Reminder logged in your notifications.')
  }

  const del = async () => {
    const ok = await askConfirm({ title: 'Delete invoice?', body: `${invoice.invoice_number} will be removed. This can be restored from a backup.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await softDeleteInvoice(invoice.id)
    toast('success', 'Invoice deleted.')
    navigate('/invoices')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button onClick={() => navigate('/invoices')} className="btn-ghost -ml-2"><ChevronLeft className="h-4 w-4" /> Invoices</button>

      <PageHeader
        title={<span className="flex items-center gap-3">{invoice.invoice_number} <InvoiceStatusBadge status={status} /></span>}
        subtitle={`${customer?.name ?? 'Customer'} · issued ${formatDate(invoice.issue_date)} · due ${formatDate(invoice.due_date)}`}
        actions={
          <>
            <button onClick={downloadPdf} className="btn-secondary"><Download className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span></button>
            {outstanding > 0 && invoice.status !== 'draft' && <button onClick={() => setPayOpen(true)} className="btn-primary"><HandCoins className="h-4 w-4" /> Record Payment</button>}
          </>
        }
      />

      {/* Amount summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-ink-400">Total</p><p className="mt-1 text-lg font-bold text-ink-900 tnum">{formatMoney(invoice.total, cur)}</p></Card>
        <Card className="p-4"><p className="text-xs text-ink-400">Paid</p><p className="mt-1 text-lg font-bold text-emerald-600 tnum">{formatMoney(invoice.paid_amount, cur)}</p></Card>
        <Card className="p-4"><p className="text-xs text-ink-400">Outstanding</p><p className="mt-1 text-lg font-bold text-rose-600 tnum">{formatMoney(outstanding, cur)}</p></Card>
        <Card className="p-4"><p className="text-xs text-ink-400">Tax</p><p className="mt-1 text-lg font-bold text-ink-900 tnum">{formatMoney(invoice.tax, cur)}</p></Card>
      </div>

      {/* Line items */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3 text-right">Qty</th>
              <th className="px-5 py-3 text-right">Rate</th>
              <th className="px-5 py-3 text-right">Tax</th>
              <th className="px-5 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {items.map((it) => (
              <tr key={it.id}>
                <td className="px-5 py-3 font-medium text-ink-800">{it.description}</td>
                <td className="px-5 py-3 text-right text-ink-600 tnum">{it.quantity}</td>
                <td className="px-5 py-3 text-right text-ink-600 tnum">{formatMoney(it.unit_price, cur)}</td>
                <td className="px-5 py-3 text-right text-ink-500 tnum">{it.tax_rate}%</td>
                <td className="px-5 py-3 text-right font-semibold text-ink-800 tnum">{formatMoney(it.line_total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-ink-100 px-5 py-4">
          <div className="w-full max-w-xs space-y-2">
            <Row label="Subtotal" value={formatMoney(invoice.subtotal, cur)} />
            {invoice.discount > 0 && <Row label="Discount" value={`- ${formatMoney(invoice.discount, cur)}`} />}
            <Row label="Tax" value={formatMoney(invoice.tax, cur)} />
            <div className="h-px bg-ink-100" />
            <Row label="Total" value={formatMoney(invoice.total, cur)} big />
            {invoice.paid_amount > 0 && <Row label="Balance Due" value={formatMoney(outstanding, cur)} big tone="text-rose-600" />}
          </div>
        </div>
      </Card>

      {/* Payments */}
      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-ink-900">Payment History</h2>
        {payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-400">No payments recorded yet.</p>
        ) : (
          <div className="divide-y divide-ink-50">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-4.5 w-4.5" /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-800">{formatMoney(p.amount, cur)} · {p.payment_method}</p>
                  <p className="text-xs text-ink-400">{formatDate(p.date)} {p.reference_number ? `· ${p.reference_number}` : ''}</p>
                </div>
                <span className="text-xs text-ink-400">{relativeTime(p.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <Card className="flex flex-wrap gap-2 p-4">
        <button onClick={() => navigate(`/invoices/${invoice.id}/edit`)} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</button>
        <button onClick={duplicate} className="btn-secondary"><Copy className="h-4 w-4" /> Duplicate</button>
        {invoice.status === 'draft' && <button onClick={markSent} className="btn-secondary"><Send className="h-4 w-4" /> Mark Sent</button>}
        {outstanding > 0 && invoice.status !== 'draft' && (
          <button
            onClick={() => openWhatsApp(customer?.phone, reminderMessage({ customerName: customer?.name, businessName: company.name, amount: outstanding, currency: cur, ref: invoice.invoice_number, dueDate: formatDate(invoice.due_date) }))}
            className="btn-secondary text-emerald-700"
            title={customer?.phone ? undefined : 'Add a phone number to the customer to send directly'}
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
        )}
        {outstanding > 0 && invoice.status !== 'draft' && <button onClick={sendReminder} className="btn-secondary"><Bell className="h-4 w-4" /> Log Reminder</button>}
        <button onClick={downloadPdf} className="btn-secondary"><Download className="h-4 w-4" /> Download PDF</button>
        <button onClick={del} className="btn-ghost ml-auto text-rose-600"><Trash2 className="h-4 w-4" /> Delete</button>
      </Card>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment" subtitle={`${invoice.invoice_number} · ${formatMoney(outstanding, cur)} outstanding`}>
        <PaymentForm companyId={company.id} fixedInvoiceId={invoice.id} onDone={() => setPayOpen(false)} />
      </Modal>
    </div>
  )
}

function Row({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={big ? 'font-semibold text-ink-900' : 'text-sm text-ink-500'}>{label}</span>
      <span className={`tnum ${big ? 'text-lg font-bold' : 'text-sm font-medium'} ${tone ?? 'text-ink-900'}`}>{value}</span>
    </div>
  )
}
