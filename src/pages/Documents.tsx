import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany, useDocuments, useCustomers, useVendors } from '@/state/hooks'
import { PageHeader } from '@/components/ui/StatCard'
import { Card, Tabs, EmptyState, Badge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { DocumentUploadForm } from '@/components/records/DocumentUploadForm'
import { deleteDocument } from '@/db/repo'
import { humanFileSize, isImage, isPdf } from '@/lib/files'
import { triggerDownload } from '@/services/BackupService'
import { formatDate } from '@/lib/format'
import { useApp, toast } from '@/state/store'
import { Upload, FileText, ImageIcon, Download, Trash2, Eye, File as FileIcon, Link2 } from 'lucide-react'
import type { DocumentRecord, DocumentCategory } from '@/db/types'

type Tab = 'all' | DocumentCategory

export function Documents() {
  const company = useCompany()
  const documents = useDocuments()
  const customers = useCustomers()
  const vendors = useVendors()
  const navigate = useNavigate()
  const askConfirm = useApp((s) => s.askConfirm)
  const [tab, setTab] = useState<Tab>('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [preview, setPreview] = useState<{ doc: DocumentRecord; url: string } | null>(null)

  if (!company) return null

  const filtered = documents.filter((d) => tab === 'all' || d.category === tab)
  const count = (c: DocumentCategory) => documents.filter((d) => d.category === c).length

  const openPreview = (doc: DocumentRecord) => {
    if (!doc.blob) return toast('info', 'This document has no stored file.')
    const url = URL.createObjectURL(doc.blob)
    setPreview({ doc, url })
  }
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const download = (doc: DocumentRecord) => {
    if (!doc.blob) return
    triggerDownload(doc.blob, doc.filename)
  }

  const del = async (doc: DocumentRecord) => {
    const ok = await askConfirm({ title: 'Delete document?', body: `${doc.filename} will be removed from FinSutra.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await deleteDocument(doc.id)
    toast('success', 'Document deleted.')
  }

  const linkInfo = (d: DocumentRecord) => {
    if (d.linked_invoice_id) return { label: 'Invoice', to: `/invoices/${d.linked_invoice_id}` }
    if (d.linked_customer_id) return { label: customers.find((c) => c.id === d.linked_customer_id)?.name ?? 'Customer', to: `/customers/${d.linked_customer_id}` }
    if (d.linked_vendor_id) return { label: vendors.find((v) => v.id === d.linked_vendor_id)?.name ?? 'Vendor', to: `/vendors/${d.linked_vendor_id}` }
    if (d.linked_transaction_id) return { label: 'Transaction', to: `/transactions` }
    return null
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Documents" subtitle="Receipts, bills, invoices and payment evidence" actions={<button onClick={() => setUploadOpen(true)} className="btn-primary"><Upload className="h-4 w-4" /> Upload</button>} />

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'all', label: 'All', count: documents.length },
        { key: 'Invoices', label: 'Invoices', count: count('Invoices') },
        { key: 'Receipts', label: 'Receipts', count: count('Receipts') },
        { key: 'Bills', label: 'Bills', count: count('Bills') },
        { key: 'Payment Evidence', label: 'Payment', count: count('Payment Evidence') },
        { key: 'Other', label: 'Other', count: count('Other') },
      ]} />

      {filtered.length === 0 ? (
        <EmptyState icon={<FileIcon className="h-5 w-5" />} title="No documents here" body="Upload a receipt or bill — FinSutra can even extract the transaction for you." action={<button onClick={() => setUploadOpen(true)} className="btn-primary"><Upload className="h-4 w-4" /> Upload</button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((d) => {
            const link = linkInfo(d)
            return (
              <Card key={d.id} className="group overflow-hidden">
                <button onClick={() => openPreview(d)} className="flex aspect-[4/3] w-full items-center justify-center bg-ink-50">
                  {d.blob && isImage(d.mime_type) ? (
                    <img src={URL.createObjectURL(d.blob)} alt={d.filename} className="h-full w-full object-cover" onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)} />
                  ) : isPdf(d.mime_type) ? (
                    <FileText className="h-10 w-10 text-rose-400" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-ink-300" />
                  )}
                </button>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-ink-800">{d.filename}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-400">
                    <Badge tone="neutral">{d.category}</Badge>
                    <span>{humanFileSize(d.size)}</span>
                  </div>
                  {link && (
                    <button onClick={() => navigate(link.to)} className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                      <Link2 className="h-3 w-3" /> {link.label}
                    </button>
                  )}
                  <div className="mt-2 flex items-center gap-1 border-t border-ink-50 pt-2">
                    <button onClick={() => openPreview(d)} className="flex-1 rounded-lg p-2.5 text-ink-500 hover:bg-ink-100" title="Preview" aria-label="Preview"><Eye className="mx-auto h-4 w-4" /></button>
                    <button onClick={() => download(d)} className="flex-1 rounded-lg p-2.5 text-ink-500 hover:bg-ink-100" title="Download" aria-label="Download"><Download className="mx-auto h-4 w-4" /></button>
                    <button onClick={() => del(d)} className="flex-1 rounded-lg p-2.5 text-ink-500 hover:bg-rose-50 hover:text-rose-600" title="Delete" aria-label="Delete"><Trash2 className="mx-auto h-4 w-4" /></button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Document">
        <DocumentUploadForm companyId={company.id} onDone={() => setUploadOpen(false)} />
      </Modal>

      {preview && (
        <Modal open onClose={closePreview} title={preview.doc.filename} size="lg" footer={<button onClick={() => download(preview.doc)} className="btn-primary w-full"><Download className="h-4 w-4" /> Download</button>}>
          {isImage(preview.doc.mime_type) ? (
            <img src={preview.url} alt={preview.doc.filename} className="mx-auto max-h-[60vh] rounded-xl" />
          ) : isPdf(preview.doc.mime_type) ? (
            <iframe src={preview.url} title={preview.doc.filename} className="h-[60vh] w-full rounded-xl border border-ink-200" />
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">Preview not available. Download to view.</p>
          )}
        </Modal>
      )}
    </div>
  )
}
