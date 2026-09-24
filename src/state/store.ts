import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'
export interface Toast {
  id: string
  type: ToastType
  message: string
}

export type RecordPreset =
  | 'menu'
  | 'income'
  | 'expense'
  | 'invoice'
  | 'invoice_received'
  | 'payment'
  | 'transfer'
  | 'document'
  | 'ai'

interface ConfirmState {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger: boolean
  resolve?: (v: boolean) => void
}

interface AppState {
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void

  recordOpen: boolean
  recordPreset: RecordPreset
  openRecord: (preset?: RecordPreset) => void
  closeRecord: () => void

  searchOpen: boolean
  setSearchOpen: (v: boolean) => void

  online: boolean
  setOnline: (v: boolean) => void

  confirm: ConfirmState
  askConfirm: (opts: { title: string; body: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>
  resolveConfirm: (v: boolean) => void
}

export const useApp = create<AppState>((set, get) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => get().removeToast(id), 4200)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  recordOpen: false,
  recordPreset: 'menu',
  openRecord: (preset = 'menu') => set({ recordOpen: true, recordPreset: preset }),
  closeRecord: () => set({ recordOpen: false }),

  searchOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),

  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (v) => set({ online: v }),

  confirm: { open: false, title: '', body: '', confirmLabel: 'Confirm', danger: false },
  askConfirm: ({ title, body, confirmLabel = 'Confirm', danger = false }) =>
    new Promise<boolean>((resolve) => {
      set({ confirm: { open: true, title, body, confirmLabel, danger, resolve } })
    }),
  resolveConfirm: (v) => {
    const { confirm } = get()
    confirm.resolve?.(v)
    set({ confirm: { ...confirm, open: false, resolve: undefined } })
  },
}))

export function toast(type: ToastType, message: string) {
  useApp.getState().addToast(type, message)
}
