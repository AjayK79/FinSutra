import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'
import type { InvoiceStatus } from '@/db/types'

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Avatar({ name, className, color }: { name?: string; className?: string; color?: string }) {
  const palette = ['bg-brand-100 text-brand-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700']
  const idx = (name ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-xs font-bold',
        color ?? palette[idx],
        className ?? 'h-9 w-9',
      )}
    >
      {initials(name)}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'red' | 'amber' | 'blue' | 'violet'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-600',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-sky-50 text-sky-700',
    violet: 'bg-brand-50 text-brand-700',
  }
  return <span className={cn('chip', tones[tone], className)}>{children}</span>
}

const STATUS_MAP: Record<InvoiceStatus, { label: string; tone: 'neutral' | 'green' | 'red' | 'amber' | 'blue' | 'violet'; dot: string }> = {
  draft: { label: 'Draft', tone: 'neutral', dot: 'bg-ink-400' },
  sent: { label: 'Sent', tone: 'blue', dot: 'bg-sky-500' },
  partially_paid: { label: 'Partially Paid', tone: 'amber', dot: 'bg-amber-500' },
  paid: { label: 'Paid', tone: 'green', dot: 'bg-emerald-500' },
  overdue: { label: 'Overdue', tone: 'red', dot: 'bg-rose-500' },
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STATUS_MAP[status]
  return (
    <Badge tone={s.tone}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </Badge>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-ink-100', className)} />
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('no-scrollbar flex gap-1 overflow-x-auto', className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === t.key ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100',
          )}
        >
          {t.label}
          {t.count != null && (
            <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]', value === t.key ? 'bg-white/20' : 'bg-ink-200 text-ink-600')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'green' | 'amber' | 'red' }) {
  const tones = { brand: 'bg-brand-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500' }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}
