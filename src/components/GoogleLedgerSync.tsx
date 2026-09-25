import { useState } from 'react'
import { Card, Badge } from '@/components/ui/primitives'
import { useGoogleAuth } from '@/state/useGoogleAuth'
import { getClientId, setClientId } from '@/services/GoogleDriveService'
import { getDriveFolderId } from '@/config'
import { LedgerSync } from '@/services/google/ledger'
import { SyncEngine } from '@/services/google/syncEngine'
import { toast } from '@/state/store'
import { relativeTime } from '@/lib/format'
import { Cloud, Check, KeyRound, LogOut, RefreshCw, ExternalLink, FolderOpen, Sparkles } from 'lucide-react'

const LAST_SYNC_KEY = 'finsutra_ledger_last_sync'

export function GoogleLedgerSync() {
  const { email, signedIn, configured, signIn, signOut } = useGoogleAuth()

  const [clientId, setClientIdState] = useState(getClientId())
  const [busy, setBusy] = useState<string | null>(null)
  const [sheetUrl, setSheetUrl] = useState<string>('')
  const [lastSync, setLastSync] = useState<string>(() => {
    try { return localStorage.getItem(LAST_SYNC_KEY) || '' } catch { return '' }
  })

  const folderId = getDriveFolderId()

  const saveClientId = () => {
    setClientId(clientId)
    toast('success', clientId ? 'Client ID saved. Now sign in with Google.' : 'Client ID cleared.')
  }

  const doSignIn = async () => {
    setBusy('signin')
    try {
      await signIn()
      toast('success', 'Signed in to Google.')
    } catch (e: any) {
      toast('error', e?.message ?? 'Sign-in failed.')
    } finally {
      setBusy(null)
    }
  }

  const sync = async () => {
    setBusy('sync')
    try {
      await SyncEngine.syncNow()
      const s = SyncEngine.getStatus()
      if (s.state === 'error') {
        toast('error', s.error || 'Sync failed.')
      } else {
        setLastSync(s.lastSync)
        toast('success', 'Synced with Google Drive.')
        try { const id = await LedgerSync.ensure(); setSheetUrl(LedgerSync.spreadsheetUrl(id)) } catch { /* ignore */ }
      }
    } finally {
      setBusy(null)
    }
  }

  const openSheet = async () => {
    setBusy('open')
    try {
      const id = await LedgerSync.ensure()
      const url = LedgerSync.spreadsheetUrl(id)
      setSheetUrl(url)
      window.open(url, '_blank', 'noopener')
    } catch (e: any) {
      toast('error', e?.message ?? 'Could not open the ledger.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Cloud className="h-5 w-5" /></div>
          <h2 className="text-base font-semibold text-ink-900">Google Sheet Sync</h2>
        </div>
        {signedIn ? <Badge tone="green"><Check className="h-3 w-3" /> Signed in</Badge> : <Badge tone="neutral">Not signed in</Badge>}
      </div>

      <p className="mb-4 text-sm text-ink-500">
        FlaminQo's ledger lives in one private Google Sheet, with evidence images filed by month — all inside your shared Drive folder. Sign in with an approved Google account to sync.
      </p>

      {/* Client ID */}
      <div className="mb-4 rounded-xl border border-ink-200 bg-ink-50/50 p-3.5">
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-700"><KeyRound className="h-4 w-4" /> Google OAuth Client ID</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={clientId} onChange={(e) => setClientIdState(e.target.value)} placeholder="…apps.googleusercontent.com" className="input flex-1 font-mono text-xs" />
          <button onClick={saveClientId} className="btn-secondary">Save</button>
        </div>
        <p className="mt-1.5 text-xs text-ink-400">From your Google Cloud project (Web application client). Required once.</p>
      </div>

      {!configured ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Add your Client ID above to enable Google sign-in.</div>
      ) : !signedIn ? (
        <button onClick={doSignIn} disabled={!!busy} className="btn-primary w-full">
          {busy === 'signin' ? 'Signing in…' : 'Sign in with Google'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm">
            <span className="text-emerald-800">Signed in as <span className="font-semibold">{email}</span></span>
            <button onClick={() => signOut()} className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={sync} disabled={!!busy} className="btn-primary">
              <RefreshCw className={`h-4 w-4 ${busy === 'sync' || (busy && busy !== 'open') ? 'animate-spin' : ''}`} />
              {busy && busy !== 'open' && busy !== 'signin' ? busy : 'Sync to Google Sheet'}
            </button>
            <button onClick={openSheet} disabled={!!busy} className="btn-secondary"><ExternalLink className="h-4 w-4" /> Open ledger</button>
            <a href={`https://drive.google.com/drive/folders/${folderId}`} target="_blank" rel="noopener noreferrer" className="btn-ghost"><FolderOpen className="h-4 w-4" /> Drive folder</a>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-400">
            {lastSync && <span>Last synced {relativeTime(lastSync)}</span>}
            {sheetUrl && <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Open sheet ↗</a>}
          </div>

          <p className="flex items-start gap-1.5 rounded-lg bg-brand-50/60 p-2.5 text-xs text-ink-500">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
            "Sync" pushes any entries not yet in the sheet (deduplicated), and uploads their evidence images into monthly folders.
          </p>
        </div>
      )}
    </Card>
  )
}
