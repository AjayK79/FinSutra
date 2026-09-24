import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useApp } from '@/state/store'
import { cn } from '@/lib/cn'

export function ToastHost() {
  const toasts = useApp((s) => s.toasts)
  const remove = useApp((s) => s.removeToast)

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => {
        const conf = {
          success: { icon: CheckCircle2, cls: 'border-emerald-200 bg-white text-emerald-700' },
          error: { icon: XCircle, cls: 'border-rose-200 bg-white text-rose-700' },
          info: { icon: Info, cls: 'border-ink-200 bg-white text-ink-700' },
        }[t.type]
        const Icon = conf.icon
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 shadow-pop animate-slide-up',
              conf.cls,
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-medium text-ink-800">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-ink-400 hover:text-ink-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
