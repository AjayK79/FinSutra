import { useState } from 'react'
import { Field, SelectField } from '@/components/ui/Field'
import { AttachmentPicker } from './AttachmentPicker'
import { ExtractionReview, type ResolvedRecord } from './ExtractionReview'
import { AIExtractionService, type Extraction } from '@/services/AIExtractionService'
import { applyResolved } from './apply'
import { createDocument } from '@/db/repo'
import { isImage, isPdf } from '@/lib/files'
import { toast } from '@/state/store'
import { formatMoney } from '@/lib/format'
import { Sparkles, Save } from 'lucide-react'
import type { DocumentCategory } from '@/db/types'

const CATEGORIES: DocumentCategory[] = ['Receipts', 'Invoices', 'Bills', 'Payment Evidence', 'Other']

export function DocumentUploadForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [category, setCategory] = useState<DocumentCategory>('Receipts')
  const [extraction, setExtraction] = useState<Extraction | null>(null)
  const [busy, setBusy] = useState(false)

  const file = files[0]
  const canExtract = file && (isImage(file.type) || isPdf(file.type))

  const saveOnly = async () => {
    if (!files.length) return
    setBusy(true)
    for (const f of files) {
      await createDocument({
        company_id: companyId,
        filename: f.name,
        mime_type: f.type || 'application/octet-stream',
        size: f.size,
        category,
        blob: f,
      })
    }
    toast('success', `${files.length} document${files.length > 1 ? 's' : ''} saved.`)
    onDone()
  }

  const extract = async () => {
    if (!file) return
    setBusy(true)
    try {
      const ex = isPdf(file.type)
        ? await AIExtractionService.extractFromPdf(file)
        : await AIExtractionService.extractFromImage(file)
      setExtraction(ex)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (r: ResolvedRecord) => {
    await applyResolved(companyId, r, files, category)
    toast('success', `${formatMoney(r.amount, 'INR')} recorded from document.`)
    onDone()
  }

  if (extraction) {
    return (
      <ExtractionReview
        extraction={extraction}
        companyId={companyId}
        onBack={() => setExtraction(null)}
        onConfirm={confirm}
        confirmLabel="Record & Attach"
      />
    )
  }

  return (
    <div className="space-y-4">
      <AttachmentPicker files={files} onChange={setFiles} label="Choose a receipt, bill or invoice" />
      <Field label="Category">
        <SelectField value={category} onChange={(v) => setCategory(v as DocumentCategory)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      </Field>
      {canExtract && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <Sparkles className="h-4 w-4" /> Extract a transaction from this file
          </div>
          <p className="mt-1 text-xs text-ink-500">
            FinSutra reads the file on-device and pre-fills a transaction for you to review.
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={saveOnly} disabled={!files.length || busy} className="btn-secondary flex-1">
          <Save className="h-4 w-4" /> Save document
        </button>
        {canExtract && (
          <button onClick={extract} disabled={busy} className="btn-primary flex-1">
            <Sparkles className="h-4 w-4" /> {busy ? 'Reading…' : 'Extract with AI'}
          </button>
        )}
      </div>
    </div>
  )
}
