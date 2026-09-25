import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/database'
import { uid, deviceId } from '@/lib/id'
import { setActiveCompanyId } from '@/db/repo'
import { ensureDefaultCategories, seedDemoData } from '@/db/seed'
import { emitLocalChange } from '@/lib/changeBus'
import { Field, TextField, SelectField } from '@/components/ui/Field'
import { toast } from '@/state/store'
import { ArrowRight, ArrowLeft, Check, HardDrive, Cloud, Sparkles, Wallet, Users, FileText } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { BusinessType, DataMode } from '@/db/types'

const BIZ_TYPES: BusinessType[] = ['Freelancer', 'Agency', 'Consulting', 'Services', 'Retail', 'Trading', 'Other']
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD']

export function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [fy, setFy] = useState('Apr 2026 - Mar 2027')
  const [type, setType] = useState<BusinessType>('Agency')
  const [gstin, setGstin] = useState('')
  const [dataMode, setDataMode] = useState<DataMode>('local')
  const [error, setError] = useState('')

  const exploreDemo = async () => {
    setBusy(true)
    await seedDemoData()
    toast('success', 'Welcome to the FinSutra demo!')
    navigate('/dashboard')
  }

  const validateBiz = () => {
    if (!name.trim()) return 'Business name is required.'
    if (!owner.trim()) return 'Owner name is required.'
    return ''
  }

  const finish = async () => {
    setBusy(true)
    const companyId = uid('company')
    const nowISO = new Date().toISOString()
    await db.companies.put({
      id: companyId, name: name.trim(), owner_name: owner.trim(), email, phone, currency, financial_year: fy, business_type: type, gstin, address: '', data_mode: dataMode, created_at: nowISO, updated_at: nowISO,
    })
    await db.users.put({ id: uid('usr'), company_id: companyId, name: owner.trim(), email, role: 'Owner', created_at: nowISO })
    await db.sync_metadata.put({ device_id: deviceId(), sync_version: 0, connected: false, demo_mode: false })
    await ensureDefaultCategories(companyId)
    setActiveCompanyId(companyId)
    localStorage.removeItem('finsutra_demo')
    emitLocalChange() // push the new business up to Drive
    toast('success', `${name} is ready!`)
    navigate('/dashboard')
  }

  return (
    <div className="app-bg flex min-h-screen">
      {/* Left brand panel (desktop) */}
      <div className="relative hidden w-2/5 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none"><path d="M22 29h20a1 1 0 0 1 0 6H31l11 13h-8L23 35h-1v13h-6V20h6v9z" fill="currentColor" /><path d="M22 20h20a1 1 0 0 1 0 6H22v-6z" fill="currentColor" opacity="0.9" /></svg>
          </div>
          <span className="text-lg font-bold">FinSutra</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">Your business money, understood automatically.</h1>
          <p className="mt-3 text-white/70">Record. Track. Invoice. Collect. Understand — all offline-first, on your device.</p>
          <div className="mt-8 space-y-3">
            {[{ icon: Wallet, t: 'Know your cash position instantly' }, { icon: Users, t: 'See who owes you and who you owe' }, { icon: FileText, t: 'Create invoices & track receivables' }, { icon: Sparkles, t: 'Ask your AI CFO anything' }].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-white/90"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><f.icon className="h-4 w-4" /></div>{f.t}</div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/50">Works completely offline · Your data stays with you</p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          {step === 0 && (
            <div className="animate-fade-in text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop lg:hidden">
                <svg width="30" height="30" viewBox="0 0 64 64" fill="none"><path d="M22 29h20a1 1 0 0 1 0 6H31l11 13h-8L23 35h-1v13h-6V20h6v9z" fill="currentColor" /><path d="M22 20h20a1 1 0 0 1 0 6H22v-6z" fill="currentColor" opacity="0.9" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-ink-900">Welcome to FinSutra</h2>
              <p className="mt-2 text-ink-500">Your business money, understood automatically.</p>
              <div className="mt-8 space-y-3">
                <button onClick={() => setStep(1)} className="btn-primary w-full py-3 text-base">Create My Business <ArrowRight className="h-4 w-4" /></button>
                <button onClick={exploreDemo} disabled={busy} className="btn-secondary w-full py-3 text-base"><Sparkles className="h-4 w-4" /> {busy ? 'Loading…' : 'Explore Demo'}</button>
              </div>
              <p className="mt-4 text-xs text-ink-400">Explore the full product with sample data — no account needed.</p>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <Stepper step={1} />
              <h2 className="text-xl font-bold text-ink-900">Create your business</h2>
              <p className="mt-1 text-sm text-ink-500">Just the essentials — you can change these later.</p>
              <div className="mt-6 space-y-4">
                <Field label="Business name" required><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. TalentRayz Technologies" autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Owner name" required><TextField value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Your name" /></Field>
                  <Field label="Phone"><TextField type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></Field>
                </div>
                <Field label="Email"><TextField type="email" inputMode="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Currency"><SelectField value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></Field>
                  <Field label="Business type"><SelectField value={type} onChange={(v) => setType(v as BusinessType)} options={BIZ_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Financial year"><TextField value={fy} onChange={(e) => setFy(e.target.value)} /></Field>
                  <Field label="GSTIN"><TextField value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="Optional" /></Field>
                </div>
                {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setStep(0)} className="btn-secondary"><ArrowLeft className="h-4 w-4" /></button>
                  <button onClick={() => { const e = validateBiz(); if (e) return setError(e); setError(''); setStep(2) }} className="btn-primary flex-1">Continue <ArrowRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <Stepper step={2} />
              <h2 className="text-xl font-bold text-ink-900">Choose data mode</h2>
              <p className="mt-1 text-sm text-ink-500">You can change this anytime in Settings.</p>
              <div className="mt-6 space-y-3">
                <ModeCard active={dataMode === 'local'} onClick={() => setDataMode('local')} icon={<HardDrive className="h-5 w-5" />} title="Local Only" body="Your data stays on this device. Fully private, works offline." />
                <ModeCard active={dataMode === 'drive'} onClick={() => setDataMode('drive')} icon={<Cloud className="h-5 w-5" />} title="Local + Google Drive Backup" body="Keep your data backed up and available across devices. Connect Drive later in Settings." />
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary"><ArrowLeft className="h-4 w-4" /></button>
                <button onClick={finish} disabled={busy} className="btn-primary flex-1">{busy ? 'Setting up…' : 'Create My Business'} <Check className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {[1, 2].map((s) => (
        <div key={s} className={cn('h-1.5 flex-1 rounded-full', s <= step ? 'bg-brand-600' : 'bg-ink-200')} />
      ))}
    </div>
  )
}

function ModeCard({ active, onClick, icon, title, body }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition', active ? 'border-brand-500 bg-brand-50/50' : 'border-ink-200 bg-white hover:border-ink-300')}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500')}>{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="mt-0.5 text-xs text-ink-500">{body}</p>
      </div>
      <div className={cn('mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2', active ? 'border-brand-600 bg-brand-600' : 'border-ink-300')}>
        {active && <Check className="h-3 w-3 text-white" />}
      </div>
    </button>
  )
}
