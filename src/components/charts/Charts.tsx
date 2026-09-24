import { useState } from 'react'
import { formatMoneyCompact, formatMoney } from '@/lib/format'
import type { MonthlyCashFlow } from '@/lib/calc'

const COLORS = {
  income: '#059669',
  expense: '#e11d48',
  net: '#4f46e5',
  grid: '#e2e8f0',
  axis: '#94a3b8',
}

export function CashFlowChart({ data, currency = 'INR' }: { data: MonthlyCashFlow[]; currency?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = 260
  const padL = 44
  const padR = 16
  const padB = 28
  const padT = 16
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)))
  const groupW = chartW / data.length
  const barW = Math.min(28, groupW * 0.28)
  const y = (v: number) => padT + chartH - (v / max) * chartH

  const netPoints = data.map((d, i) => {
    const cx = padL + groupW * i + groupW / 2
    return [cx, y(Math.max(0, d.net))] as [number, number]
  })

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id="netGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = padT + chartH - t * chartH
          return (
            <g key={t}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke={COLORS.grid} strokeWidth={1} />
              <text x={padL - 8} y={yy + 3} textAnchor="end" fontSize={10} fill={COLORS.axis}>
                {formatMoneyCompact(max * t, currency)}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const gx = padL + groupW * i
          const cx = gx + groupW / 2
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={gx} y={padT} width={groupW} height={chartH} fill={hover === i ? '#f1f5f9' : 'transparent'} rx={6} />
              <rect x={cx - barW - 2} y={y(d.income)} width={barW} height={padT + chartH - y(d.income)} fill="url(#incomeGrad)" rx={5} />
              <rect x={cx + 2} y={y(d.expenses)} width={barW} height={padT + chartH - y(d.expenses)} fill="url(#expenseGrad)" rx={5} />
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={COLORS.axis} fontWeight={hover === i ? 700 : 400}>
                {d.label}
              </text>
            </g>
          )
        })}
        {/* net line */}
        <polyline
          points={netPoints.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="url(#netGrad)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {netPoints.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 5 : 3.5} fill="#fff" stroke={COLORS.net} strokeWidth={2} />
        ))}
      </svg>

      {hover != null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs shadow-pop">
          <div className="mb-1 font-semibold text-ink-800">{data[hover].label}</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.income }} /> Income <span className="ml-auto font-semibold tnum">{formatMoney(data[hover].income, currency)}</span></div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.expense }} /> Expenses <span className="ml-auto font-semibold tnum">{formatMoney(data[hover].expenses, currency)}</span></div>
          <div className="mt-0.5 flex items-center gap-2 border-t border-ink-100 pt-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.net }} /> Net <span className="ml-auto font-semibold tnum">{formatMoney(data[hover].net, currency)}</span></div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.income }} /> Income</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.expense }} /> Expenses</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-full" style={{ background: COLORS.net }} /> Net movement</span>
      </div>
    </div>
  )
}

const DONUT_COLORS = ['#4f46e5', '#059669', '#e11d48', '#d97706', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f43f5e', '#64748b', '#22c55e']

export function DonutChart({
  data,
  currency = 'INR',
  size = 180,
}: {
  data: { label: string; value: number }[]
  currency?: string
  size?: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const [hover, setHover] = useState<number | null>(null)
  if (total === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-ink-400">No data yet</div>
  }
  const radius = size / 2
  const stroke = size * 0.16
  const r = radius - stroke / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${radius} ${radius})`}>
            {data.map((d, i) => {
              const frac = d.value / total
              const dash = frac * circ
              const seg = (
                <circle
                  key={i}
                  cx={radius}
                  cy={radius}
                  r={r}
                  fill="none"
                  stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                  strokeWidth={hover === i ? stroke + 4 : stroke}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-offset}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: 'stroke-width 0.15s' }}
                />
              )
              offset += dash
              return seg
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-ink-400">{hover != null ? data[hover].label : 'Total'}</span>
          <span className="text-lg font-bold text-ink-900 tnum">
            {formatMoneyCompact(hover != null ? data[hover].value : total, currency)}
          </span>
        </div>
      </div>
      <div className="w-full space-y-1.5">
        {data.slice(0, 6).map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-sm"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="truncate text-ink-600">{d.label}</span>
            <span className="ml-auto font-semibold text-ink-800 tnum">{formatMoney(d.value, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MiniTrend({ values, color = '#4f46e5' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const W = 80
  const H = 28
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - ((v - min) / range) * H])
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
