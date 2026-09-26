import { GST_RATES, gstBreakdown } from '@/lib/calc'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface GstValue {
  applicable: boolean
  rate: number
}

export function GstField({
  value,
  onChange,
  amount,
  currency = 'INR',
}: {
  value: GstValue
  onChange: (v: GstValue) => void
  amount: number | ''
  currency?: string
}) {
  const amt = typeof amount === 'number' ? amount : 0
  const { taxable, gst } = gstBreakdown(amt, value.applicable ? value.rate : 0)

  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3.5">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={value.applicable}
          onChange={(e) => onChange({ applicable: e.target.checked, rate: value.rate || 18 })}
          className="h-4 w-4 rounded border-ink-300 text-brand-600"
        />
        <span className="text-sm font-medium text-ink-700">GST applies to this payment</span>
      </label>

      {value.applicable && (
        <div className="mt-3 space-y-2.5">
          <div className="flex gap-1.5">
            {GST_RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ applicable: true, rate: r })}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-sm font-semibold transition',
                  value.rate === r ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-ink-600 border border-ink-200 hover:bg-ink-50',
                )}
              >
                {r}%
              </button>
            ))}
          </div>
          {amt > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
              <span className="text-ink-500">Of {formatMoney(amt, currency)} (incl.)</span>
              <span className="text-ink-700">
                Taxable <span className="font-semibold tnum">{formatMoney(taxable, currency)}</span>
                <span className="mx-1.5 text-ink-300">·</span>
                GST <span className="font-semibold tnum">{formatMoney(gst, currency)}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
