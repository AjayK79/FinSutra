import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { useNotifications, useCompany } from '@/state/hooks'
import { markNotificationRead, markAllNotificationsRead } from '@/db/repo'
import { relativeTime } from '@/lib/format'
import { AlertTriangle, Clock, CloudOff, Info, CheckCheck, BellOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { AppNotification } from '@/db/types'

const ICONS = {
  overdue: { icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
  due_soon: { icon: Clock, tone: 'text-amber-600 bg-amber-50' },
  payable_due: { icon: Clock, tone: 'text-sky-600 bg-sky-50' },
  sync_failure: { icon: CloudOff, tone: 'text-ink-600 bg-ink-100' },
  info: { icon: Info, tone: 'text-brand-600 bg-brand-50' },
}

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notifications = useNotifications()
  const company = useCompany()
  const navigate = useNavigate()

  const go = (n: AppNotification) => {
    markNotificationRead(n.id)
    if (n.link) {
      navigate(n.link)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notifications"
      subtitle={notifications.length ? `${notifications.filter((n) => !n.read).length} unread` : undefined}
      footer={
        notifications.length > 0 ? (
          <button
            onClick={() => company && markAllNotificationsRead(company.id)}
            className="btn-ghost w-full"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        ) : undefined
      }
    >
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <BellOff className="mb-3 h-8 w-8 text-ink-300" />
          <p className="text-sm font-medium text-ink-600">You're all caught up</p>
          <p className="mt-1 text-sm text-ink-400">Alerts about overdue invoices and due payments show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const conf = ICONS[n.type] ?? ICONS.info
            const Icon = conf.icon
            return (
              <button
                key={n.id}
                onClick={() => go(n)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
                  n.read ? 'border-ink-100 bg-white hover:bg-ink-50' : 'border-brand-100 bg-brand-50/40 hover:bg-brand-50',
                )}
              >
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', conf.tone)}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink-800">{n.title}</p>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-400">{relativeTime(n.created_at)}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
