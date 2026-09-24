import { useMemo, useState } from 'react'
import { Field, MoneyField, SelectField, Combo, TextField, SegmentedControl } from '@/components/ui/Field'
import { Badge } from '@/components/ui/primitives'
import { Sparkles, AlertTriangle, ArrowDownLeft, ArrowUpRight, FileText } from 'lucide-react'
import { confidenceLabel, type Extraction } from '@/services/AIExtractionService'
import { useCustomers, useVendors, useCategories } from '@/state/hooks'
import { createCustomer, createVendor } from '@/db/repo'
import { toDateInput } from '@/lib/format'
import type { PaymentMethod } from '@/db/types'

export interface ResolvedRecord {
  type: 'income' | 'expense' | 'invoice' | 'transfer'
  amount: number
  date: string
  description: string
  category: string
  customer_id: string | null
  vendor_id: string | null
  payment_method: PaymentMethod
  due_in_days?: number | null
}

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Bank', 'UPI', 'Card', 'Cheque', 'Other']

export function ExtractionReview({
  extraction,
  companyId,
  onConfirm,
  onBack,
  confirmLabel = 'Confirm & Record',
}: {
  extraction: Extraction
  companyId: string
  onConfirm: (r: ResolvedRecord) => void
  onBack?: () => void
  confirmLabel?: string
}) {
  const customers = useCustomers()
  const vendors = useVendors()
  const categories = useCategories()

  const [type, setType] = useState<ResolvedRecord['type']>(extraction.type)
  const [amount, setAmount] = useState<number | ''>(extraction.amount ?? '')
  const [date, setDate] = useState(toDateInput(extraction.date))
  const [description, setDescription] = useState(extraction.description)
  const [category, setCategory] = useState(extraction.category)
  const [method, setMethod] = useState<PaymentMethod>('Bank')
  const [partyId, setPartyId] = useState<string>('')
  const [error, setError] = useState('')

  const isIncomeSide = type === 'income' || type === 'invoice'

  // Preselect a matching party by name
  useMemo(() => {
    if (!extraction.party) return
    const pool = isIncomeSide ? customers : vendors
    const match = pool.find(
      (p) => p.name.toLowerCase() === extraction.party!.toLowerCase() ||
        p.name.toLowerCase().includes(extraction.party!.toLowerCase()),
    )
    if (match) setPartyId(match.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers.length, vendors.length, isIncomeSide])

  const conf = confidenceLabel(extraction.confidence)
  const catOptions = categories
    .filter((c) => (isIncomeSide ? c.type === 'income' : c.type === 'expense'))
    .map((c) => ({ value: c.name, label: c.name }))
  if (!catOptions.some((c) => c.value === category) && category) {
    catOptions.unshift({ value: category, label: category })
  }

  const handleCreateParty = async (name: string) => {
    if (isIncomeSide) {
      const c = await createCustomer({ company_id: companyId, name })
      setPartyId(c.id)
    } else {
      const v = await createVendor({ company_id: companyId, name })
      setPartyId(v.id)
    }
  }

  const submit = () => {
    if (amount === '' || amount <= 0) return setError('Please enter a valid amount.')
    if (type !== 'transfer' && !partyId) {
      return setError(isIncomeSide ? 'Please choose a customer.' : 'Please choose a vendor.')
    }
    setError('')
    onConfirm({
      type,
      amount: amount as number,
      date,
      description: description || 'Transaction',
      category,
      customer_id: isIncomeSide ? partyId : null,
      vendor_id: !isIncomeSide ? partyId : null,
      payment_method: method,
      due_in_days: extraction.due_in_days,
    })
  }

  return (
    <div className="space-y-4">
      {/* AI banner */}
      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink-800">FinSutra detected this</p>
            <Badge tone={conf.tone === 'high' ? 'green' : conf.tone === 'medium' ? 'amber' : 'red'}>
              {conf.label} · {Math.round(extraction.confidence * 100)}%
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">Review and edit anything before saving — nothing is recorded until you confirm.</p>
        </div>
      </div>

      {extraction.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="space-y-0.5">
            {extraction.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Field label="What happened?">
        <SegmentedControl
          value={type}
          onChange={(v) => setType(v)}
          options={[
            { value: 'income', label: 'Received', icon: <ArrowDownLeft className="h-4 w-4" /> },
            { value: 'expense', label: 'Spent', icon: <ArrowUpRight className="h-4 w-4" /> },
            { value: 'invoice', label: 'Invoice', icon: <FileText className="h-4 w-4" /> },
          ]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" required>
          <MoneyField value={amount} onChange={setAmount} currency={extraction.currency} />
        </Field>
        <Field label="Date">
          <TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {type !== 'transfer' && (
        <Field label={isIncomeSide ? 'Customer' : 'Vendor'} required>
          <Combo
            value={partyId}
            onChange={setPartyId}
            options={(isIncomeSide ? customers : vendors).map((p) => ({ id: p.id, name: p.name }))}
            onCreate={handleCreateParty}
            placeholder={isIncomeSide ? 'Select customer' : 'Select vendor'}
            createLabel="Add"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <SelectField value={category} onChange={setCategory} options={catOptions} placeholder="Select" />
        </Field>
        <Field label="Payment method">
          <SelectField value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
        </Field>
      </div>

      <Field label="Description">
        <TextField value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" />
      </Field>

      {type === 'invoice' && (
        <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
          This will open a pre-filled invoice draft — you'll review the full invoice before it's created.
        </p>
      )}

      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        {onBack && (
          <button onClick={onBack} className="btn-secondary">
            Back
          </button>
        )}
        <button onClick={submit} className="btn-primary flex-1">
          {type === 'invoice' ? 'Review invoice draft' : confirmLabel}
        </button>
      </div>
    </div>
  )
}
