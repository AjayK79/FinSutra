import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Field, TextField, TextArea } from '@/components/ui/Field'
import { createCustomer, updateCustomer, createVendor, updateVendor } from '@/db/repo'
import { toast } from '@/state/store'
import type { Customer, Vendor } from '@/db/types'

export function PartyFormModal({
  open,
  onClose,
  kind,
  companyId,
  existing,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  kind: 'customer' | 'vendor'
  companyId: string
  existing?: Customer | Vendor
  onSaved?: (id: string) => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [gstin, setGstin] = useState(existing?.gstin ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) return setError('Name is required.')
    setError('')
    const payload = { name: name.trim(), email, phone, gstin, address, notes }
    try {
      if (existing) {
        if (kind === 'customer') await updateCustomer(existing.id, payload)
        else await updateVendor(existing.id, payload)
        toast('success', `${kind === 'customer' ? 'Customer' : 'Vendor'} updated.`)
        onSaved?.(existing.id)
      } else {
        const row = kind === 'customer'
          ? await createCustomer({ company_id: companyId, ...payload })
          : await createVendor({ company_id: companyId, ...payload })
        toast('success', `${kind === 'customer' ? 'Customer' : 'Vendor'} added.`)
        onSaved?.(row.id)
      }
      onClose()
    } catch {
      setError('Something went wrong.')
    }
  }

  const title = existing ? `Edit ${kind}` : `New ${kind}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title.charAt(0).toUpperCase() + title.slice(1)}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} className="btn-primary">{existing ? 'Save' : 'Add'}</button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required><TextField value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder={kind === 'customer' ? 'e.g. ABC Technologies' : 'e.g. AWS'} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><TextField type="email" inputMode="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" /></Field>
          <Field label="Phone"><TextField type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></Field>
        </div>
        <Field label="GSTIN"><TextField value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Address"><TextArea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Modal>
  )
}
