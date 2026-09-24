// ---------------------------------------------------------------------------
// ExportService — offline CSV / JSON / PDF exports and invoice PDF generation.
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatMoney, formatDate, currencySymbol } from '@/lib/format'
import { triggerDownload } from './BackupService'
import { computeInvoiceTotals } from '@/lib/calc'
import type {
  Transaction,
  Invoice,
  InvoiceItem,
  Customer,
  Vendor,
  Company,
} from '@/db/types'

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export const ExportService = {
  exportTransactionsCSV(
    transactions: Transaction[],
    customers: Customer[],
    vendors: Vendor[],
  ) {
    const cName = (id?: string | null) => customers.find((c) => c.id === id)?.name ?? ''
    const vName = (id?: string | null) => vendors.find((v) => v.id === id)?.name ?? ''
    const headers = [
      'Date', 'Type', 'Description', 'Category', 'Party', 'Payment Method',
      'Reference', 'Amount', 'Status',
    ]
    const rows = transactions
      .filter((t) => !t.deleted_at)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((t) => [
        t.date,
        t.type,
        t.description,
        t.category,
        cName(t.customer_id) || vName(t.vendor_id),
        t.payment_method,
        t.reference_number ?? '',
        t.amount,
        t.status,
      ])
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
    triggerDownload(new Blob([csv], { type: 'text/csv' }), `finsutra-ledger-${today()}.csv`)
  },

  exportJSON(payload: unknown, name = 'finsutra-ledger') {
    triggerDownload(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `${name}-${today()}.json`,
    )
  },

  /** A one-page PDF summary of the business position. */
  exportSummaryPDF(opts: {
    company: Company
    metrics: { label: string; value: string }[]
    topCustomers: { name: string; value: string }[]
    categorySpend: { name: string; value: string }[]
  }) {
    const doc = new jsPDF()
    const { company, metrics, topCustomers, categorySpend } = opts
    doc.setFontSize(20)
    doc.setTextColor(30, 27, 75)
    doc.text('FinSutra — Financial Summary', 14, 20)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(company.name, 14, 28)
    doc.text(`Generated ${formatDate(new Date(), 'dd MMM yyyy, HH:mm')}`, 14, 34)

    autoTable(doc, {
      startY: 42,
      head: [['Key figures', '']],
      body: metrics.map((m) => [m.label, m.value]),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
    })

    let y = (doc as any).lastAutoTable.finalY + 8
    autoTable(doc, {
      startY: y,
      head: [['Top customers by outstanding', 'Amount']],
      body: topCustomers.length ? topCustomers.map((c) => [c.name, c.value]) : [['—', '—']],
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105] },
    })

    y = (doc as any).lastAutoTable.finalY + 8
    autoTable(doc, {
      startY: y,
      head: [['Top expense categories', 'Amount']],
      body: categorySpend.length ? categorySpend.map((c) => [c.name, c.value]) : [['—', '—']],
      theme: 'striped',
      headStyles: { fillColor: [225, 29, 72] },
    })

    doc.save(`finsutra-summary-${today()}.pdf`)
  },

  /** Generate a polished invoice PDF. */
  generateInvoicePDF(
    invoice: Invoice,
    items: InvoiceItem[],
    customer: Customer | undefined,
    company: Company,
    action: 'save' | 'blob' = 'save',
  ): Blob | void {
    const doc = new jsPDF()
    const cur = company.currency ?? 'INR'
    const sym = currencySymbol(cur)
    const money = (n: number) => `${sym}${new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
    const margin = 14
    const pageW = doc.internal.pageSize.getWidth()

    // Header band
    doc.setFillColor(79, 70, 229)
    doc.rect(0, 0, pageW, 4, 'F')

    doc.setFontSize(22)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text(company.name, margin, 22)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100)
    let hy = 28
    if (company.address) { doc.text(company.address, margin, hy); hy += 5 }
    if (company.email) { doc.text(company.email, margin, hy); hy += 5 }
    if (company.phone) { doc.text(company.phone, margin, hy); hy += 5 }
    if (company.gstin) { doc.text(`GSTIN: ${company.gstin}`, margin, hy); hy += 5 }

    // Invoice title block (right)
    doc.setFontSize(26)
    doc.setTextColor(79, 70, 229)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', pageW - margin, 22, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(80)
    doc.text(`# ${invoice.invoice_number}`, pageW - margin, 30, { align: 'right' })
    doc.text(`Issued: ${formatDate(invoice.issue_date)}`, pageW - margin, 36, { align: 'right' })
    doc.text(`Due: ${formatDate(invoice.due_date)}`, pageW - margin, 42, { align: 'right' })

    // Bill to
    const billY = Math.max(hy, 48) + 4
    doc.setFontSize(9)
    doc.setTextColor(130)
    doc.text('BILL TO', margin, billY)
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text(customer?.name ?? 'Customer', margin, billY + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(90)
    let by = billY + 13
    if (customer?.address) { doc.text(customer.address, margin, by); by += 5 }
    if (customer?.email) { doc.text(customer.email, margin, by); by += 5 }
    if (customer?.gstin) { doc.text(`GSTIN: ${customer.gstin}`, margin, by); by += 5 }

    // Line items
    autoTable(doc, {
      startY: by + 6,
      head: [['Description', 'Qty', 'Rate', 'Disc %', 'Tax %', 'Amount']],
      body: items.map((it) => [
        it.description,
        String(it.quantity),
        money(it.unit_price),
        `${it.discount}%`,
        `${it.tax_rate}%`,
        money(it.line_total),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], halign: 'left' },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      styles: { fontSize: 9, cellPadding: 3 },
    })

    const totals = computeInvoiceTotals(items)
    let ty = (doc as any).lastAutoTable.finalY + 8
    const labelX = pageW - margin - 60
    const valueX = pageW - margin
    const line = (label: string, value: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(bold ? 15 : 90, bold ? 23 : 90, bold ? 42 : 90)
      doc.setFontSize(bold ? 12 : 10)
      doc.text(label, labelX, ty)
      doc.text(value, valueX, ty, { align: 'right' })
      ty += bold ? 8 : 6
    }
    line('Subtotal', money(totals.subtotal))
    if (totals.discount > 0) line('Discount', `- ${money(totals.discount)}`)
    line('Tax', money(totals.tax))
    doc.setDrawColor(220)
    doc.line(labelX, ty - 2, valueX, ty - 2)
    ty += 2
    line('Total', money(invoice.total), true)
    if (invoice.paid_amount > 0) {
      line('Paid', `- ${money(invoice.paid_amount)}`)
      line('Balance Due', money(invoice.outstanding_amount), true)
    }

    // Notes / payment instructions
    let ny = ty + 8
    if (invoice.payment_instructions) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(130)
      doc.text('PAYMENT INSTRUCTIONS', margin, ny)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90)
      doc.setFontSize(9)
      const lines = doc.splitTextToSize(invoice.payment_instructions, pageW - 2 * margin)
      doc.text(lines, margin, ny + 5)
      ny += 5 + lines.length * 5 + 4
    }
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(130)
      doc.text('NOTES', margin, ny)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90)
      const lines = doc.splitTextToSize(invoice.notes, pageW - 2 * margin)
      doc.text(lines, margin, ny + 5)
    }

    // Footer
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.setTextColor(160)
    doc.text('Generated with FinSutra — Your business money, understood automatically.', margin, pageH - 10)

    if (action === 'blob') return doc.output('blob')
    doc.save(`${invoice.invoice_number}.pdf`)
  },
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
