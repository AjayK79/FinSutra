import { createDocument } from '@/db/repo'
import type { DocumentCategory } from '@/db/types'

export interface AttachmentMeta {
  company_id: string
  category: DocumentCategory
  linked_transaction_id?: string | null
  linked_invoice_id?: string | null
  linked_customer_id?: string | null
  linked_vendor_id?: string | null
}

export async function persistAttachments(files: File[], meta: AttachmentMeta): Promise<string[]> {
  const ids: string[] = []
  for (const file of files) {
    const doc = await createDocument({
      company_id: meta.company_id,
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size: file.size,
      category: meta.category,
      blob: file,
      linked_transaction_id: meta.linked_transaction_id ?? null,
      linked_invoice_id: meta.linked_invoice_id ?? null,
      linked_customer_id: meta.linked_customer_id ?? null,
      linked_vendor_id: meta.linked_vendor_id ?? null,
    })
    ids.push(doc.id)
  }
  return ids
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImage(mime: string) {
  return mime.startsWith('image/')
}
export function isPdf(mime: string) {
  return mime === 'application/pdf'
}
