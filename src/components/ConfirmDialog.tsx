import { Modal } from '@/components/ui/Modal'
import { useApp } from '@/state/store'
import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog() {
  const confirm = useApp((s) => s.confirm)
  const resolve = useApp((s) => s.resolveConfirm)

  return (
    <Modal
      open={confirm.open}
      onClose={() => resolve(false)}
      size="sm"
      title={confirm.title}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={() => resolve(false)} className="btn-secondary">
            Cancel
          </button>
          <button onClick={() => resolve(true)} className={confirm.danger ? 'btn-danger' : 'btn-primary'}>
            {confirm.confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex gap-3">
        {confirm.danger && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        )}
        <p className="text-sm text-ink-600">{confirm.body}</p>
      </div>
    </Modal>
  )
}
