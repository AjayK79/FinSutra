// Build wa.me deep links so the user can send a pre-filled reminder from their
// own WhatsApp (nothing is sent automatically — they review and tap send).

import { formatMoney } from './format'

/** Normalise an Indian phone number to wa.me format (country code + number). */
export function normalizePhone(phone?: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return '91' + digits
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1)
  return digits
}

export function waLink(phone: string | undefined, message: string): string {
  const p = normalizePhone(phone)
  const base = p ? `https://wa.me/${p}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(phone: string | undefined, message: string) {
  window.open(waLink(phone, message), '_blank', 'noopener')
}

export function reminderMessage(opts: {
  customerName?: string
  businessName?: string
  amount: number
  currency?: string
  ref?: string // invoice number / event name
  dueDate?: string
}): string {
  const { customerName, businessName, amount, currency = 'INR', ref, dueDate } = opts
  const amt = formatMoney(amount, currency)
  const lines = [
    `Hi ${customerName || 'there'},`,
    ``,
    `Gentle reminder: ${amt} is pending${ref ? ` for ${ref}` : ''}${dueDate ? ` (due ${dueDate})` : ''}.`,
    `Please transfer at your convenience.`,
    ``,
    `Thank you,`,
    businessName || 'FlaminQo Events',
  ]
  return lines.join('\n')
}
