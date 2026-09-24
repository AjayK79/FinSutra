import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

type Tone = 'neutral' | 'green' | 'red' | 'blue' | 'amber' | 'brand' | 'hero' | 'violet'

// Soft pastel gradient surfaces per tone
const SURFACE: Record<Tone, string> = {
  neutral: 'from-slate-50 to-slate-100/70 border-white/70',
  brand: 'from-indigo-50 to-violet-100/70 border-white/70',
  green: 'from-emerald-50 to-teal-100/70 border-white/70',
  red: 'from-rose-50 to-orange-100/60 border-white/70',
  blue: 'from-sky-50 to-cyan-100/70 border-white/70',
  amber: 'from-amber-50 to-yellow-100/70 border-white/70',
  violet: 'from-violet-50 to-fuchsia-100/70 border-white/70',
  hero: 'border-white/20',
}

const VALUE_TONE: Record<Tone, string> = {
  neutral: 'text-ink-900',
  brand: 'text-indigo-700',
  green: 'text-emerald-700',
  red: 'text-rose-600',
  blue: 'text-sky-700',
  amber: 'text-amber-700',
  violet: 'text-fuchsia-700',
  hero: 'text-white',
}

const ICON_TONE: Record<Tone, string> = {
  neutral: 'bg-white/80 text-slate-500',
  brand: 'bg-white/80 text-indigo-600',
  green: 'bg-white/80 text-emerald-600',
  red: 'bg-white/80 text-rose-500',
  blue: 'bg-white/80 text-sky-600',
  amber: 'bg-white/80 text-amber-600',
  violet: 'bg-white/80 text-fuchsia-600',
  hero: 'bg-white/20 text-white',
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'neutral',
  sub,
  onClick,
  className,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: Tone
  sub?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? 'button' : 'div'
  const isHero = tone === 'hero'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left shadow-card transition-all sm:p-5',
        SURFACE[tone],
        !isHero && 'backdrop-blur-sm',
        onClick && 'hover:-translate-y-0.5 hover:shadow-soft',
        className,
      )}
      style={isHero ? { backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #9333ea 100%)' } : undefined}
    >
      {isHero && (
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      )}
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold uppercase tracking-wide sm:text-[13px] sm:font-medium sm:normal-case sm:tracking-normal', isHero ? 'text-white/80' : 'text-ink-500')}>
          {label}
        </span>
        {icon && <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl shadow-sm', ICON_TONE[tone])}>{icon}</div>}
      </div>
      <div>
        <div className={cn('text-xl font-bold tracking-tight tnum sm:text-2xl', VALUE_TONE[tone])}>{value}</div>
        {sub && <div className={cn('mt-1 text-xs', isHero ? 'text-white/70' : 'text-ink-500')}>{sub}</div>}
      </div>
    </Comp>
  )
}
