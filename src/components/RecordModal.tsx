import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { useApp, type RecordPreset } from '@/state/store'
import { useCompany } from '@/state/hooks'
import { AIRecordForm } from './records/AIRecordForm'
import { IncomeForm, ExpenseForm, PaymentForm, TransferForm } from './records/RecordForms'
import { DocumentUploadForm } from './records/DocumentUploadForm'
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  FileInput,
  HandCoins,
  ArrowLeftRight,
  Upload,
  ChevronLeft,
} from 'lucide-react'

type View = RecordPreset

const MENU: { key: View; label: string; sub: string; icon: typeof FileText; tone: string }[] = [
  { key: 'income', label: 'Money Received', sub: 'Record income from a customer', icon: ArrowDownLeft, tone: 'bg-emerald-50 text-emerald-600' },
  { key: 'expense', label: 'Money Spent', sub: 'Record an expense you paid', icon: ArrowUpRight, tone: 'bg-rose-50 text-rose-600' },
  { key: 'invoice', label: 'Invoice Raised', sub: 'Bill a customer', icon: FileText, tone: 'bg-brand-50 text-brand-600' },
  { key: 'invoice_received', label: 'Invoice Received', sub: 'A bill you need to pay', icon: FileInput, tone: 'bg-amber-50 text-amber-600' },
  { key: 'payment', label: 'Payment Against Invoice', sub: 'Record money received on an invoice', icon: HandCoins, tone: 'bg-sky-50 text-sky-600' },
  { key: 'transfer', label: 'Transfer', sub: 'Move money between accounts', icon: ArrowLeftRight, tone: 'bg-violet-50 text-violet-600' },
  { key: 'document', label: 'Upload Document', sub: 'Receipt, bill or invoice', icon: Upload, tone: 'bg-ink-100 text-ink-600' },
]

const TITLES: Record<string, string> = {
  income: 'Money Received',
  expense: 'Money Spent',
  invoice_received: 'Invoice Received',
  payment: 'Record Payment',
  transfer: 'Transfer',
  document: 'Upload Document',
  ai: 'Tell FinSutra what happened',
  menu: 'What happened?',
}

export function RecordModal() {
  const open = useApp((s) => s.recordOpen)
  const preset = useApp((s) => s.recordPreset)
  const close = useApp((s) => s.closeRecord)
  const company = useCompany()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('menu')

  useEffect(() => {
    if (open) setView(preset)
  }, [open, preset])

  const go = (key: View) => {
    if (key === 'invoice') {
      close()
      navigate('/invoices/new')
      return
    }
    setView(key)
  }

  const onDone = () => close()

  if (!company) return null

  const showBack = view !== 'menu'

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          {showBack && (
            <button onClick={() => setView('menu')} className="btn-ghost -ml-2 rounded-full p-1.5">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {TITLES[view] ?? 'Record'}
        </span>
      }
      size={view === 'menu' ? 'lg' : 'md'}
    >
      {view === 'menu' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-4 text-white">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20">✨</span>
              Just tell FinSutra
            </div>
            <AIInline onDone={onDone} />
          </div>

          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-100" />
            <span className="text-xs font-medium text-ink-400">or choose manually</span>
            <div className="h-px flex-1 bg-ink-100" />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MENU.map((m) => (
              <button
                key={m.key}
                onClick={() => go(m.key)}
                className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/30"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.tone}`}>
                  <m.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800">{m.label}</p>
                  <p className="truncate text-xs text-ink-400">{m.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'ai' && <AIRecordForm companyId={company.id} onDone={onDone} />}
      {view === 'income' && <IncomeForm companyId={company.id} onDone={onDone} />}
      {view === 'expense' && <ExpenseForm companyId={company.id} onDone={onDone} />}
      {view === 'invoice_received' && <ExpenseForm companyId={company.id} onDone={onDone} asBill />}
      {view === 'payment' && <PaymentForm companyId={company.id} onDone={onDone} />}
      {view === 'transfer' && <TransferForm companyId={company.id} onDone={onDone} />}
      {view === 'document' && <DocumentUploadForm companyId={company.id} onDone={onDone} />}
    </Modal>
  )
}

// Compact AI entry inside the menu that expands to the full flow.
function AIInline({ onDone }: { onDone: () => void }) {
  const company = useCompany()
  const [expanded, setExpanded] = useState(false)
  if (!company) return null
  if (expanded) {
    return (
      <div className="rounded-xl bg-white p-3 text-ink-900">
        <AIRecordForm companyId={company.id} onDone={onDone} />
      </div>
    )
  }
  return (
    <button
      onClick={() => setExpanded(true)}
      className="w-full rounded-xl bg-white/15 px-3.5 py-3 text-left text-sm text-white/80 transition hover:bg-white/25"
    >
      Paid ₹18,500 to ABC Printers for brochures…
    </button>
  )
}
