import { type ReactNode, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { currencySymbol } from '@/lib/format'
import { ChevronDown, Check, Plus, Search } from 'lucide-react'

export function Field({
  label,
  children,
  hint,
  error,
  required,
  className,
}: {
  label?: string
  children: ReactNode
  hint?: string
  error?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input', props.className)} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('input min-h-[80px] resize-y', props.className)} />
}

export function MoneyField({
  value,
  onChange,
  currency = 'INR',
  placeholder = '0',
  autoFocus,
  className,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  currency?: string
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-500">
        {currencySymbol(currency)}
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value === '' ? '' : value}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '')
          if (raw === '') return onChange('')
          const n = parseFloat(raw)
          onChange(isNaN(n) ? '' : n)
        }}
        className="input pl-8 text-base font-semibold tnum"
      />
    </div>
  )
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input appearance-none pr-9">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
    </div>
  )
}

/** Searchable combo with optional inline "create new". */
export function Combo({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  onCreate,
  createLabel = 'Add',
}: {
  value: string
  onChange: (id: string) => void
  options: { id: string; name: string; sub?: string }[]
  placeholder?: string
  onCreate?: (name: string) => void
  createLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.id === value)
  const filtered = options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
  const showCreate = onCreate && query.trim().length > 1 && !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between text-left"
      >
        <span className={cn('truncate', selected ? 'text-ink-900' : 'text-ink-400')}>
          {selected?.name ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop animate-scale-in">
          <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-ink-50"
              >
                <span>
                  <span className="font-medium text-ink-800">{o.name}</span>
                  {o.sub && <span className="ml-2 text-xs text-ink-400">{o.sub}</span>}
                </span>
                {o.id === value && <Check className="h-4 w-4 text-brand-600" />}
              </button>
            ))}
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-3 text-center text-sm text-ink-400">No matches</p>
            )}
            {showCreate && (
              <button
                type="button"
                onClick={() => {
                  onCreate!(query.trim())
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center gap-2 border-t border-ink-100 px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" />
                {createLabel} “{query.trim()}”
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition',
            value === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
