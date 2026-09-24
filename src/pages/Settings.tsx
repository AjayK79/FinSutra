import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany, useSyncMetadata, usePendingSyncCount } from '@/state/hooks'
import { db } from '@/db/database'
import { PageHeader } from '@/components/ui/StatCard'
import { Card, Badge } from '@/components/ui/primitives'
import { Field, TextField, SelectField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useApp, toast } from '@/state/store'
import { SyncManager, type SyncConflict } from '@/services/SyncManager'
import { getClientId, setClientId, resetDrive } from '@/services/GoogleDriveService'
import { BackupService, type BackupPackage } from '@/services/BackupService'
import { ExportService } from '@/services/ExportService'
import { seedDemoData } from '@/db/seed'
import { clearAllData } from '@/db/database'
import { relativeTime, formatMoney } from '@/lib/format'
import type { BusinessType } from '@/db/types'
import {
  Building2, Cloud, CloudOff, RefreshCw, Save, Upload, Download, Trash2, ShieldCheck,
  Sparkles, AlertTriangle, Check, Link2, KeyRound, FileJson, FileText, Database, RotateCcw,
} from 'lucide-react'

const BIZ_TYPES: BusinessType[] = ['Freelancer', 'Agency', 'Consulting', 'Services', 'Retail', 'Trading', 'Other']
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD']

export function Settings() {
  const company = useCompany()
  const meta = useSyncMetadata()
  const pending = usePendingSyncCount()
  const askConfirm = useApp((s) => s.askConfirm)
  const navigate = useNavigate()

  if (!company) return null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" subtitle="Business profile, sync, backup and privacy" />
      <BusinessProfile company={company} />
      <DriveSync meta={meta} pending={pending} />
      <DataPrivacy company={company} />
      <DemoControls />
      <About />
    </div>
  )
}

// --- Business profile -----------------------------------------------------

function BusinessProfile({ company }: { company: NonNullable<ReturnType<typeof useCompany>> }) {
  const [name, setName] = useState(company.name)
  const [owner, setOwner] = useState(company.owner_name)
  const [email, setEmail] = useState(company.email)
  const [phone, setPhone] = useState(company.phone)
  const [currency, setCurrency] = useState(company.currency)
  const [fy, setFy] = useState(company.financial_year)
  const [type, setType] = useState<BusinessType>(company.business_type)
  const [gstin, setGstin] = useState(company.gstin ?? '')
  const [address, setAddress] = useState(company.address ?? '')

  const save = async () => {
    await db.companies.update(company.id, {
      name, owner_name: owner, email, phone, currency, financial_year: fy, business_type: type, gstin, address, updated_at: new Date().toISOString(),
    })
    toast('success', 'Business profile updated.')
  }

  return (
    <Card className="p-5">
      <SectionTitle icon={<Building2 className="h-5 w-5" />} title="Business Profile" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Business name"><TextField value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Owner name"><TextField value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
        <Field label="Email"><TextField type="email" inputMode="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Phone"><TextField type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Currency"><SelectField value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></Field>
        <Field label="Financial year"><TextField value={fy} onChange={(e) => setFy(e.target.value)} /></Field>
        <Field label="Business type"><SelectField value={type} onChange={(v) => setType(v as BusinessType)} options={BIZ_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
        <Field label="GSTIN"><TextField value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Address" className="sm:col-span-2"><TextField value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shown on invoices" /></Field>
      </div>
      <div className="mt-4 flex justify-end"><button onClick={save} className="btn-primary"><Save className="h-4 w-4" /> Save changes</button></div>
    </Card>
  )
}

// --- Google Drive sync ----------------------------------------------------

function DriveSync({ meta, pending }: { meta: ReturnType<typeof useSyncMetadata>; pending: number }) {
  const [clientId, setClientIdState] = useState(getClientId())
  const [busy, setBusy] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<SyncConflict[]>(SyncManager.getConflicts())
  const connected = !!meta?.connected
  const demo = !getClientId()

  const refreshConflicts = () => setConflicts(SyncManager.getConflicts())

  const saveClientId = () => {
    setClientId(clientId)
    resetDrive()
    toast('success', clientId ? 'Google OAuth Client ID saved. You can now connect the real Drive.' : 'Cleared — using Demo Sync.')
  }

  const connect = async () => {
    setBusy('connect')
    try {
      const status = await SyncManager.connect()
      toast('success', status.demo ? 'Connected to Demo Sync.' : `Connected to Google Drive${status.email ? ` (${status.email})` : ''}.`)
    } catch (e: any) {
      toast('error', e?.message ?? 'Could not connect.')
    } finally {
      setBusy(null)
    }
  }

  const disconnect = async () => {
    await SyncManager.disconnect()
    toast('info', 'Disconnected.')
  }

  const sync = async () => {
    setBusy('sync')
    try {
      const res = await SyncManager.sync((msg) => setBusy(msg))
      toast('success', `Synced — ${res.pushed} change${res.pushed === 1 ? '' : 's'} pushed.`)
    } catch (e: any) {
      toast('error', e?.message ?? 'Sync failed.')
    } finally {
      setBusy(null)
    }
  }

  const backup = async () => {
    setBusy('backup')
    try {
      await SyncManager.backupNow()
      toast('success', 'Backup uploaded to Drive.')
    } catch (e: any) {
      toast('error', e?.message ?? 'Backup failed.')
    } finally {
      setBusy(null)
    }
  }

  const simulateConflict = async () => {
    const c = await SyncManager.simulateConflict()
    if (c) { refreshConflicts(); toast('info', 'A sample sync conflict was created below.') }
    else toast('info', 'Add a transaction first to simulate a conflict.')
  }

  const resolve = async (id: string, choice: 'local' | 'cloud') => {
    await SyncManager.resolveConflict(id, choice)
    refreshConflicts()
    toast('success', `Kept ${choice} version.`)
  }

  return (
    <Card className="p-5">
      <SectionTitle icon={<Cloud className="h-5 w-5" />} title="Google Drive Sync" right={
        connected ? <Badge tone="green"><Check className="h-3 w-3" /> Connected{demo ? ' · Demo' : ''}</Badge> : <Badge tone="neutral"><CloudOff className="h-3 w-3" /> Not Connected</Badge>
      } />

      <p className="mb-4 text-sm text-ink-500">
        Your data lives on this device. Google Drive is used only for backup and multi-device sync.
        {demo ? ' No OAuth Client ID is configured, so FinSutra uses a clearly-labelled ' : ' A real Google OAuth Client ID is configured. '}
        {demo && <span className="font-semibold text-amber-700">Demo Sync</span>}
        {demo && ' — simulated locally, never presented as a real Google connection.'}
      </p>

      {/* Client ID config */}
      <div className="mb-4 rounded-xl border border-ink-200 bg-ink-50/50 p-3.5">
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-700"><KeyRound className="h-4 w-4" /> Google OAuth Client ID</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={clientId} onChange={(e) => setClientIdState(e.target.value)} placeholder="xxxxx.apps.googleusercontent.com" className="input flex-1 font-mono text-xs" />
          <button onClick={saveClientId} className="btn-secondary">Save</button>
        </div>
        <p className="mt-1.5 text-xs text-ink-400">Paste your OAuth Web Client ID (scope <code>drive.file</code>) with this app's origin allow-listed. Leave blank to use Demo Sync.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <button onClick={connect} disabled={!!busy} className="btn-primary"><Link2 className="h-4 w-4" /> {busy === 'connect' ? 'Connecting…' : demo ? 'Connect Demo Drive' : 'Connect Google Drive'}</button>
        ) : (
          <>
            <button onClick={sync} disabled={!!busy} className="btn-primary"><RefreshCw className={`h-4 w-4 ${busy === 'sync' ? 'animate-spin' : ''}`} /> {busy && busy !== 'connect' && busy !== 'backup' ? busy : 'Sync Now'}</button>
            <button onClick={backup} disabled={!!busy} className="btn-secondary"><Database className="h-4 w-4" /> Backup to Drive</button>
            <button onClick={disconnect} className="btn-ghost text-ink-600">Disconnect</button>
          </>
        )}
        <button onClick={simulateConflict} className="btn-ghost text-ink-500">Simulate conflict</button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
        {meta?.last_sync_at && <span>Last synced {relativeTime(meta.last_sync_at)}</span>}
        <span>{pending} pending change{pending === 1 ? '' : 's'}</span>
        {meta?.drive_email && <span>· {meta.drive_email}</span>}
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" /> Sync Conflicts</div>
          {conflicts.map((c) => (
            <div key={c.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
              <p className="text-sm text-ink-700">Two versions of a {c.entity_type} exist. Choose which to keep.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => resolve(c.id, 'local')} className="rounded-xl border border-ink-200 bg-white p-3 text-left hover:border-brand-300">
                  <p className="text-xs text-ink-400">Local ({c.field})</p>
                  <p className="text-sm font-bold text-ink-900 tnum">{formatMoney(parseFloat(c.local))}</p>
                  <p className="mt-1 text-xs font-medium text-brand-600">Keep Local</p>
                </button>
                <button onClick={() => resolve(c.id, 'cloud')} className="rounded-xl border border-ink-200 bg-white p-3 text-left hover:border-brand-300">
                  <p className="text-xs text-ink-400">Cloud ({c.field})</p>
                  <p className="text-sm font-bold text-ink-900 tnum">{formatMoney(parseFloat(c.cloud))}</p>
                  <p className="mt-1 text-xs font-medium text-brand-600">Keep Cloud</p>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// --- Data & privacy -------------------------------------------------------

function DataPrivacy({ company }: { company: NonNullable<ReturnType<typeof useCompany>> }) {
  const askConfirm = useApp((s) => s.askConfirm)
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [restorePreview, setRestorePreview] = useState<{ pkg: BackupPackage; counts: ReturnType<typeof BackupService.countsOf> } | null>(null)

  const backupDownload = async () => {
    const pkg = await BackupService.build()
    BackupService.download(pkg)
    toast('success', 'Backup file downloaded.')
  }

  const onRestoreFile = async (file: File) => {
    try {
      const text = await file.text()
      const raw = JSON.parse(text)
      const pkg = BackupService.validate(raw)
      setRestorePreview({ pkg, counts: BackupService.countsOf(pkg) })
    } catch (e: any) {
      toast('error', e?.message ?? 'That backup file could not be read.')
    }
  }

  const doRestore = async () => {
    if (!restorePreview) return
    await BackupService.restore(restorePreview.pkg)
    setRestorePreview(null)
    toast('success', 'Backup restored.')
    setTimeout(() => window.location.reload(), 600)
  }

  const deleteLocal = async () => {
    const ok = await askConfirm({ title: 'Delete all local data?', body: 'This erases everything on this device — transactions, invoices, customers and documents. If you have a backup you can restore it. This cannot be undone.', confirmLabel: 'Delete everything', danger: true })
    if (!ok) return
    await clearAllData()
    localStorage.removeItem('finsutra_company_id')
    localStorage.removeItem('finsutra_demo')
    toast('success', 'All local data deleted.')
    setTimeout(() => navigate('/onboarding'), 400)
  }

  return (
    <Card className="p-5">
      <SectionTitle icon={<ShieldCheck className="h-5 w-5" />} title="Data & Privacy" />
      <div className="mb-4 rounded-xl bg-emerald-50 p-3.5 text-sm text-emerald-800">
        <p className="font-medium">Your financial data is stored locally on this device.</p>
        <p className="mt-1 text-emerald-700">Google Drive is used only when you enable backup or synchronization.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <ActionTile icon={<Download className="h-4 w-4" />} label="Export CSV" onClick={async () => { const [t, c, v] = await Promise.all([db.transactions.toArray(), db.customers.toArray(), db.vendors.toArray()]); ExportService.exportTransactionsCSV(t.filter((x) => !x.deleted_at), c, v); toast('success', 'Ledger exported as CSV.') }} />
        <ActionTile icon={<FileJson className="h-4 w-4" />} label="Export JSON" onClick={async () => { const pkg = await BackupService.build(); ExportService.exportJSON(pkg.data); toast('success', 'Ledger exported as JSON.') }} />
        <ActionTile icon={<Database className="h-4 w-4" />} label="Backup Now" onClick={backupDownload} />
        <ActionTile icon={<Upload className="h-4 w-4" />} label="Restore Backup" onClick={() => fileRef.current?.click()} />
        <ActionTile icon={<Trash2 className="h-4 w-4" />} label="Delete Local Data" onClick={deleteLocal} danger />
      </div>

      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onRestoreFile(f); e.target.value = '' }} />

      {restorePreview && (
        <Modal open onClose={() => setRestorePreview(null)} title="Restore backup?" subtitle={`Created ${relativeTime(restorePreview.pkg.created_at)}`}
          footer={<div className="flex justify-end gap-2"><button onClick={() => setRestorePreview(null)} className="btn-secondary">Cancel</button><button onClick={doRestore} className="btn-primary">Restore & Replace</button></div>}>
          <p className="mb-3 text-sm text-ink-600">Restoring replaces the current data on this device with the backup contents:</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(restorePreview.counts).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-50 p-3 text-center"><p className="text-lg font-bold text-ink-900 tnum">{v}</p><p className="text-xs capitalize text-ink-400">{k} found</p></div>
            ))}
          </div>
        </Modal>
      )}
    </Card>
  )
}

// --- Demo controls --------------------------------------------------------

function DemoControls() {
  const askConfirm = useApp((s) => s.askConfirm)
  const reset = async () => {
    const ok = await askConfirm({ title: 'Reset demo data?', body: 'This replaces all current data with the fresh TalentRayz sample dataset.', confirmLabel: 'Reset demo', danger: true })
    if (!ok) return
    await seedDemoData()
    toast('success', 'Demo data reset.')
    setTimeout(() => window.location.reload(), 500)
  }
  return (
    <Card className="p-5">
      <SectionTitle icon={<Sparkles className="h-5 w-5" />} title="Demo" />
      <p className="mb-3 text-sm text-ink-500">Load or reset the sample business (TalentRayz Technologies) to explore every feature and state.</p>
      <button onClick={reset} className="btn-secondary"><RotateCcw className="h-4 w-4" /> Reset Demo Data</button>
    </Card>
  )
}

function About() {
  return (
    <Card className="p-5 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <svg width="18" height="18" viewBox="0 0 64 64" fill="none"><path d="M22 29h20a1 1 0 0 1 0 6H31l11 13h-8L23 35h-1v13h-6V20h6v9z" fill="currentColor" /><path d="M22 20h20a1 1 0 0 1 0 6H22v-6z" fill="currentColor" opacity="0.9" /></svg>
      </div>
      <p className="text-sm font-semibold text-ink-800">FinSutra</p>
      <p className="text-xs text-ink-400">Your business money, understood automatically.</p>
      <p className="mt-1 text-xs text-ink-300">Offline-first MVP · v0.1.0</p>
    </Card>
  )
}

// --- shared ---------------------------------------------------------------

function SectionTitle({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      </div>
      {right}
    </div>
  )
}

function ActionTile({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition ${danger ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-ink-200 text-ink-700 hover:bg-ink-50'}`}>
      {icon}{label}
    </button>
  )
}
