import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Field, TextField, TextArea, MoneyField, SelectField, Combo } from '@/components/ui/Field'
import { useCustomers } from '@/state/hooks'
import { createEvent, updateEvent, createCustomer } from '@/db/repo'
import { toast } from '@/state/store'
import { todayISO } from '@/lib/format'
import type { EventRecord, EventStatus } from '@/db/types'

export function EventFormModal({
  open,
  onClose,
  companyId,
  existing,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  existing?: EventRecord
  onSaved?: (id: string) => void
}) {
  const customers = useCustomers()
  const [name, setName] = useState(existing?.name ?? '')
  const [customerId, setCustomerId] = useState(existing?.customer_id ?? '')
  const [eventDate, setEventDate] = useState(existing?.event_date ?? todayISO())
  const [expected, setExpected] = useState<number | ''>(existing?.expected_amount ?? '')
  const [status, setStatus] = useState<EventStatus>(existing?.status ?? 'active')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) return setError('Event name is required.')
    setError('')
    const payload = {
      name: name.trim(),
      customer_id: customerId || null,
      event_date: eventDate,
      expected_amount: expected === '' ? undefined : (expected as number),
      status,
      notes,
    }
    try {
      if (existing) {
        await updateEvent(existing.id, payload)
        toast('success', 'Event updated.')
        onSaved?.(existing.id)
      } else {
        const ev = await createEvent({ company_id: companyId, ...payload })
        toast('success', 'Event created.')
        onSaved?.(ev.id)
      }
      onClose()
    } catch {
      setError('Something went wrong.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit event' : 'New event'}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} className="btn-primary">{existing ? 'Save' : 'Create'}</button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Event name" required>
          <TextField value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Sharma Wedding, Acme Offsite" />
        </Field>
        <Field label="Client" hint="Optional">
          <Combo
            value={customerId}
            onChange={setCustomerId}
            options={customers.map((c) => ({ id: c.id, name: c.name }))}
            onCreate={async (n) => { const c = await createCustomer({ company_id: companyId, name: n }); setCustomerId(c.id) }}
            placeholder="Select client"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Event date"><TextField type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></Field>
          <Field label="Status">
            <SelectField value={status} onChange={(v) => setStatus(v as EventStatus)} options={[{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }]} />
          </Field>
        </div>
        <Field label="Expected revenue" hint="Optional — to compare against what you've received">
          <MoneyField value={expected} onChange={setExpected} />
        </Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Modal>
  )
}
