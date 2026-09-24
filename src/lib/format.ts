import {
  format as fmtDate,
  parseISO,
  isValid,
  formatDistanceToNow,
} from 'date-fns'

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SGD: 'S$',
  AUD: 'A$',
}

export function currencySymbol(currency = 'INR') {
  return CURRENCY_SYMBOLS[currency] ?? currency + ' '
}

/**
 * Indian-style grouping (lakh/crore) for INR, standard grouping otherwise.
 * formatMoney(842500) -> "₹8,42,500"
 */
export function formatMoney(
  amount: number,
  currency = 'INR',
  opts: { decimals?: boolean; sign?: boolean } = {},
): string {
  const { decimals = false, sign = false } = opts
  const symbol = currencySymbol(currency)
  const negative = amount < 0
  const abs = Math.abs(amount)
  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(abs)
  const prefix = negative ? '-' : sign ? '+' : ''
  return `${prefix}${symbol}${formatted}`
}

/** Compact form for big headline numbers: ₹8.4L, ₹1.2Cr */
export function formatMoneyCompact(amount: number, currency = 'INR'): string {
  const symbol = currencySymbol(currency)
  const negative = amount < 0
  const abs = Math.abs(amount)
  const prefix = negative ? '-' : ''
  if (currency === 'INR') {
    if (abs >= 1e7) return `${prefix}${symbol}${(abs / 1e7).toFixed(2)}Cr`
    if (abs >= 1e5) return `${prefix}${symbol}${(abs / 1e5).toFixed(2)}L`
    if (abs >= 1e3) return `${prefix}${symbol}${(abs / 1e3).toFixed(1)}K`
    return `${prefix}${symbol}${abs.toFixed(0)}`
  }
  if (abs >= 1e9) return `${prefix}${symbol}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${prefix}${symbol}${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${prefix}${symbol}${(abs / 1e3).toFixed(1)}K`
  return `${prefix}${symbol}${abs.toFixed(0)}`
}

export function safeDate(value?: string | Date | null): Date | null {
  if (!value) return null
  if (value instanceof Date) return isValid(value) ? value : null
  const d = parseISO(value)
  return isValid(d) ? d : null
}

export function formatDate(value?: string | Date | null, pattern = 'dd MMM yyyy') {
  const d = safeDate(value)
  return d ? fmtDate(d, pattern) : '—'
}

export function formatDateShort(value?: string | Date | null) {
  return formatDate(value, 'dd MMM')
}

export function relativeTime(value?: string | Date | null) {
  const d = safeDate(value)
  if (!d) return '—'
  return formatDistanceToNow(d, { addSuffix: true })
}

/** yyyy-MM-dd for <input type=date> */
export function toDateInput(value?: string | Date | null): string {
  const d = safeDate(value) ?? new Date()
  return fmtDate(d, 'yyyy-MM-dd')
}

export function todayISO() {
  return fmtDate(new Date(), 'yyyy-MM-dd')
}

export function initials(name?: string) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}
