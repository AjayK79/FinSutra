import { createTransaction } from '@/db/repo'
import { persistAttachments } from '@/lib/files'
import type { ResolvedRecord } from './ExtractionReview'
import type { DocumentCategory } from '@/db/types'

/**
 * Persist a reviewed extraction as a transaction (income/expense/transfer).
 * Invoice-type records are handled by the caller (they open the invoice draft).
 */
export async function applyResolved(
  companyId: string,
  r: ResolvedRecord,
  files: File[] = [],
  docCategory: DocumentCategory = 'Receipts',
) {
  const txn = await createTransaction({
    company_id: companyId,
    type: r.type === 'invoice' ? 'income' : r.type,
    amount: r.amount,
    date: r.date,
    description: r.description,
    category: r.category,
    customer_id: r.customer_id,
    vendor_id: r.vendor_id,
    payment_method: r.payment_method,
    status: 'completed',
  })
  if (files.length) {
    await persistAttachments(files, {
      company_id: companyId,
      category: docCategory,
      linked_transaction_id: txn.id,
      linked_customer_id: r.customer_id,
      linked_vendor_id: r.vendor_id,
    })
  }
  return txn
}
