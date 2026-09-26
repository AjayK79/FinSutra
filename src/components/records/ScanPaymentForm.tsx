import { useEffect, useRef, useState } from 'react'
import { AttachmentPicker } from './AttachmentPicker'
import { ExtractionReview, type ResolvedRecord } from './ExtractionReview'
import { AIExtractionService, type Extraction } from '@/services/AIExtractionService'
import { applyResolved } from './apply'
import { preloadOcr } from '@/services/ocr'
import { toast } from '@/state/store'
import { formatMoney } from '@/lib/format'
import { ScanLine, Sparkles } from 'lucide-react'

export function ScanPaymentForm({
  companyId,
  onDone,
  initialFile,
}: {
  companyId: string
  onDone: () => void
  initialFile?: File | null
}) {
  const [files, setFiles] = useState<File[]>(initialFile ? [initialFile] : [])
  const [extraction, setExtraction] = useState<Extraction | null>(null)
  const [reading, setReading] = useState(false)
  const ranFor = useRef<string | null>(null)

  // Warm up OCR as soon as the scan screen opens.
  useEffect(() => { preloadOcr() }, [])

  // Auto-run OCR when a file is chosen.
  useEffect(() => {
    const file = files[0]
    if (!file) return
    const key = `${file.name}:${file.size}`
    if (ranFor.current === key) return
    ranFor.current = key
    let cancelled = false
    ;(async () => {
      setReading(true)
      try {
        const ex = await AIExtractionService.extractFromImage(file)
        if (!cancelled) setExtraction(ex)
      } finally {
        if (!cancelled) setReading(false)
      }
    })()
    return () => { cancelled = true }
  }, [files])

  const confirm = async (r: ResolvedRecord) => {
    await applyResolved(companyId, r, files, 'Receipts')
    toast('success', `${formatMoney(r.amount, 'INR')} recorded from screenshot.`)
    onDone()
  }

  if (reading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <ScanLine className="h-7 w-7 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-ink-800">Reading your screenshot…</p>
        <p className="max-w-xs text-xs text-ink-400">Recognising the amount, name and date on your device. First scan may take a few seconds.</p>
      </div>
    )
  }

  if (extraction) {
    return (
      <ExtractionReview
        extraction={extraction}
        companyId={companyId}
        onBack={() => { setExtraction(null); setFiles([]); ranFor.current = null }}
        onConfirm={confirm}
        confirmLabel="Record & Attach"
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700"><Sparkles className="h-5 w-5" /></div>
        <div>
          <p className="text-sm font-semibold text-ink-800">Snap or upload a payment</p>
          <p className="mt-0.5 text-xs text-ink-500">Take a photo or pick a GPay/PhonePe/bank screenshot — FinSutra reads it on your device and fills in the entry for you to confirm.</p>
        </div>
      </div>
      <AttachmentPicker files={files} onChange={setFiles} label="Snap or upload a payment screenshot" />
      <p className="text-center text-xs text-ink-400">Nothing is saved until you review and confirm.</p>
    </div>
  )
}
