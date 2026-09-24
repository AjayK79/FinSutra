import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Bell, Plus, Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useApp } from '@/state/store'
import { useCompany, useNotifications, useSyncMetadata, usePendingSyncCount } from '@/state/hooks'
import { relativeTime } from '@/lib/format'
import { Avatar } from '@/components/ui/primitives'
import { NotificationCenter } from '@/components/NotificationCenter'
import { cn } from '@/lib/cn'

export function TopBar() {
  const company = useCompany()
  const openRecord = useApp((s) => s.openRecord)
  const setSearchOpen = useApp((s) => s.setSearchOpen)
  const online = useApp((s) => s.online)
  const meta = useSyncMetadata()
  const pending = usePendingSyncCount()
  const notifications = useNotifications()
  const unread = notifications.filter((n) => !n.read).length
  const [notifOpen, setNotifOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/50 bg-white/55 px-4 backdrop-blur-xl lg:px-6">
      {/* mobile brand */}
      <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
            <path d="M22 29h20a1 1 0 0 1 0 6H31l11 13h-8L23 35h-1v13h-6V20h6v9z" fill="currentColor" />
            <path d="M22 20h20a1 1 0 0 1 0 6H22v-6z" fill="currentColor" opacity="0.9" />
          </svg>
        </div>
        <span className="text-[15px] font-bold text-ink-900">FinSutra</span>
      </Link>

      {/* search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="hidden max-w-md flex-1 items-center gap-2.5 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-sm text-ink-400 transition hover:bg-ink-100 sm:flex"
      >
        <Search className="h-4 w-4" />
        <span>Search transactions, invoices, customers…</span>
        <kbd className="ml-auto rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-400">⌘K</kbd>
      </button>

      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
        <button onClick={() => setSearchOpen(true)} className="btn-ghost rounded-full p-2.5 sm:hidden" aria-label="Search">
          <Search className="h-5 w-5" />
        </button>

        {/* connectivity + sync */}
        <SyncPill online={online} connected={!!meta?.connected} demo={!!meta?.demo_mode} lastSync={meta?.last_sync_at} pending={pending} />

        {/* notifications */}
        <button onClick={() => setNotifOpen(true)} className="relative btn-ghost rounded-full p-2.5" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>

        {/* record */}
        <button onClick={() => openRecord('menu')} className="btn-primary">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Record</span>
        </button>

        <Link to="/settings" className="hidden sm:block">
          <Avatar name={company?.owner_name ?? 'FinSutra'} className="h-9 w-9" />
        </Link>
      </div>

      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
    </header>
  )
}

function SyncPill({
  online,
  connected,
  demo,
  lastSync,
  pending,
}: {
  online: boolean
  connected: boolean
  demo: boolean
  lastSync?: string
  pending: number
}) {
  let label: string
  let tone: string
  let Icon = Cloud

  if (!online) {
    label = 'Offline'
    tone = 'bg-amber-50 text-amber-700'
    Icon = WifiOff
  } else if (!connected) {
    label = pending > 0 ? `${pending} to sync` : 'Not synced'
    tone = 'bg-ink-100 text-ink-600'
    Icon = CloudOff
  } else if (pending > 0) {
    label = `${pending} pending`
    tone = 'bg-sky-50 text-sky-700'
    Icon = RefreshCw
  } else {
    label = lastSync ? `Synced ${relativeTime(lastSync)}` : 'Synced'
    tone = 'bg-emerald-50 text-emerald-700'
    Icon = online ? Wifi : Cloud
  }

  return (
    <Link
      to="/settings"
      className={cn('hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold sm:flex', tone)}
      title={demo ? 'Demo Sync mode' : 'Google Drive sync'}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="max-w-[120px] truncate">{label}</span>
      {demo && connected && <span className="rounded bg-white/60 px-1 text-[9px] uppercase">demo</span>}
    </Link>
  )
}
