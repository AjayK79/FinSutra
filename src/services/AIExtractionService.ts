// ---------------------------------------------------------------------------
// AIExtractionService — an on-device natural-language ledger parser.
//
// This is NOT a wrapper around a remote LLM. It runs entirely on the device
// so extraction works fully offline. It understands Indian money phrasing
// (lakh / crore / "one lakh twenty thousand"), transaction intent, parties,
// dates and categories, and returns a confidence score so the UI can insist
// on review for anything uncertain.
// ---------------------------------------------------------------------------

import { todayISO } from '@/lib/format'
import { format as fmtDate, subDays, addDays } from 'date-fns'

export interface Extraction {
  type: 'income' | 'expense' | 'transfer' | 'invoice'
  amount: number | null
  currency: string
  party: string | null
  party_type: 'customer' | 'vendor' | null
  category: string
  date: string
  description: string
  confidence: number
  // invoice-specific hints
  due_in_days?: number | null
  raw: string
  warnings: string[]
}

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
}
const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000, lac: 100000, lakhs: 100000, lacs: 100000,
  crore: 10000000, crores: 10000000, cr: 10000000,
  million: 1000000, mn: 1000000, billion: 1000000000,
}

/** Convert an English/Indian number phrase to a number, or null. */
function wordsToNumber(phrase: string): number | null {
  const tokens = phrase
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\band\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) return null

  let total = 0
  let current = 0
  let matched = false
  for (const tok of tokens) {
    if (tok in WORD_NUMBERS) {
      current += WORD_NUMBERS[tok]
      matched = true
    } else if (tok === 'hundred') {
      current = (current || 1) * 100
      matched = true
    } else if (tok in SCALES) {
      const scale = SCALES[tok]
      total += (current || 1) * scale
      current = 0
      matched = true
    } else {
      // unknown token breaks the number run
      break
    }
  }
  if (!matched) return null
  return total + current
}

const CATEGORY_KEYWORDS: { category: string; words: string[] }[] = [
  { category: 'Marketing', words: ['brochure', 'brochures', 'ad', 'ads', 'advert', 'advertising', 'marketing', 'campaign', 'print', 'banner', 'flyer', 'branding', 'seo', 'social media', 'poster'] },
  { category: 'Travel', words: ['travel', 'flight', 'flights', 'taxi', 'uber', 'ola', 'cab', 'train', 'hotel', 'fuel', 'petrol', 'diesel', 'toll', 'parking', 'airfare'] },
  { category: 'Food', words: ['food', 'lunch', 'dinner', 'restaurant', 'snacks', 'catering', 'coffee', 'meal', 'meals', 'tea', 'breakfast'] },
  { category: 'Software', words: ['aws', 'amazon web', 'google cloud', 'gcp', 'azure', 'saas', 'subscription', 'software', 'zoho', 'slack', 'figma', 'github', 'hosting', 'domain', 'license', 'notion', 'openai', 'api', 'server'] },
  { category: 'Salaries', words: ['salary', 'salaries', 'payroll', 'wages', 'stipend'] },
  { category: 'Contractors', words: ['contractor', 'contractors', 'freelancer', 'freelance', 'developer fee'] },
  { category: 'Utilities', words: ['electricity', 'water bill', 'internet', 'wifi', 'broadband', 'phone bill', 'mobile bill', 'utility', 'utilities'] },
  { category: 'Rent', words: ['rent', 'lease', 'office rent'] },
  { category: 'Equipment', words: ['laptop', 'computer', 'monitor', 'furniture', 'equipment', 'hardware', 'printer', 'desk', 'chair', 'macbook'] },
  { category: 'Office', words: ['stationery', 'office supplies', 'supplies', 'pens', 'paper', 'cleaning'] },
  { category: 'Professional Services', words: ['legal', 'lawyer', 'accountant', 'audit', 'consulting fee', 'professional', 'ca fee', 'notary'] },
]

const INCOME_CATEGORIES: { category: string; words: string[] }[] = [
  { category: 'Sales', words: ['sale', 'sales', 'order', 'product'] },
  { category: 'Services', words: ['service', 'services', 'consulting', 'retainer', 'project', 'implementation', 'development', 'design'] },
  { category: 'Interest', words: ['interest', 'dividend'] },
]

function inferCategory(text: string, type: Extraction['type']): string {
  const lower = text.toLowerCase()
  if (type === 'income' || type === 'invoice') {
    for (const { category, words } of INCOME_CATEGORIES) {
      if (words.some((w) => lower.includes(w))) return category
    }
    return 'Services'
  }
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return category
  }
  return 'Other'
}

const EXPENSE_VERBS = ['paid', 'spent', 'bought', 'purchased', 'expense', 'billed by', 'pay', 'gave']
const INCOME_VERBS = ['received', 'got', 'collected', 'earned', 'credited', 'income', 'deposited']
const INVOICE_VERBS = ['create invoice', 'raise invoice', 'invoice for', 'bill', 'make an invoice', 'new invoice']
const TRANSFER_VERBS = ['transfer', 'transferred', 'moved']

function detectType(text: string): { type: Extraction['type']; conf: number } {
  const lower = text.toLowerCase()
  if (INVOICE_VERBS.some((v) => lower.includes(v))) return { type: 'invoice', conf: 0.95 }
  if (TRANSFER_VERBS.some((v) => lower.includes(v))) return { type: 'transfer', conf: 0.8 }
  if (INCOME_VERBS.some((v) => lower.includes(v))) return { type: 'income', conf: 0.9 }
  if (EXPENSE_VERBS.some((v) => lower.includes(v))) return { type: 'expense', conf: 0.9 }
  // ambiguous — lean expense (most common) but low confidence
  return { type: 'expense', conf: 0.45 }
}

/** Parse an amount from text: ₹18,500 / 2 lakh / 2.5L / one lakh twenty thousand */
function parseAmount(text: string): { amount: number | null; conf: number } {
  const lower = text.toLowerCase()

  // 1) number + scale word: "2 lakh", "2.5 lakh", "1.2 crore", "2L", "3cr"
  const scaleMatch = lower.match(
    /(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand|million|mn|billion)\b/i,
  )
  if (scaleMatch) {
    const base = parseFloat(scaleMatch[1].replace(/,/g, ''))
    const unit = scaleMatch[2].toLowerCase()
    const mult =
      unit === 'l' || unit.startsWith('lakh') || unit.startsWith('lac')
        ? 100000
        : unit === 'cr' || unit.startsWith('crore')
          ? 10000000
          : unit === 'k' || unit === 'thousand'
            ? 1000
            : unit === 'million' || unit === 'mn'
              ? 1000000
              : unit === 'billion'
                ? 1000000000
                : 1
    if (!isNaN(base)) return { amount: Math.round(base * mult * 100) / 100, conf: 0.92 }
  }

  // 2) explicit currency-prefixed number: ₹18,500 / Rs 18500 / INR 2,00,000
  const currencyMatch = lower.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i)
  if (currencyMatch) {
    const n = parseFloat(currencyMatch[1].replace(/,/g, ''))
    if (!isNaN(n)) return { amount: n, conf: 0.95 }
  }

  // 3) word-number phrase: "one lakh twenty thousand"
  const wordMatch = lower.match(
    /((?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakhs?|lacs?|crores?|million|billion|and|[\s-])+)/i,
  )
  if (wordMatch) {
    const n = wordsToNumber(wordMatch[1])
    if (n && n > 0) return { amount: n, conf: 0.85 }
  }

  // 4) bare grouped number: "18,500" or "18500" (>= 100 to avoid catching quantities)
  const bareMatch = lower.match(/\b([\d,]{2,})(?:\.\d+)?\b/)
  if (bareMatch) {
    const n = parseFloat(bareMatch[1].replace(/,/g, ''))
    if (!isNaN(n) && n >= 100) return { amount: n, conf: 0.7 }
    if (!isNaN(n)) return { amount: n, conf: 0.5 }
  }

  return { amount: null, conf: 0 }
}

const STOP_WORDS = new Set([
  'for', 'on', 'yesterday', 'today', 'tomorrow', 'via', 'by', 'using', 'with',
  'the', 'a', 'an', 'due', 'in', 'at', 'of', 'and', 'to', 'from', 'against',
  'last', 'next', 'this', 'week', 'month', 'day', 'days', 'ago',
])

/** Extract the party name following "to"/"from"/"for". */
function parseParty(text: string, type: Extraction['type']): string | null {
  // Prefer explicit "to X" for expense, "from X" for income
  const patterns =
    type === 'income'
      ? [/\bfrom\s+(.+)/i, /\bby\s+(.+)/i]
      : type === 'invoice'
        ? [/\bfor\s+(.+)/i, /\bto\s+(.+)/i]
        : [/\bto\s+(.+)/i, /\bfrom\s+(.+)/i]

  for (const p of patterns) {
    const m = text.match(p)
    if (!m) continue
    const words = m[1].split(/\s+/)
    const collected: string[] = []
    for (const w of words) {
      const clean = w.replace(/[.,;:]$/g, '')
      const lw = clean.toLowerCase()
      if (STOP_WORDS.has(lw)) break
      // stop at money tokens
      if (/[₹]|^rs\.?$|^inr$/i.test(clean)) break
      if (/^\d/.test(clean)) break
      collected.push(clean)
      if (collected.length >= 5) break
    }
    const name = collected.join(' ').trim()
    if (name.length >= 2) return titleCase(name)
  }
  return null
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 3 || /[A-Z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Parse a date reference; defaults to today. */
function parseDate(text: string): { date: string; conf: number } {
  const lower = text.toLowerCase()
  const now = new Date()
  if (/\byesterday\b/.test(lower)) return { date: fmtDate(subDays(now, 1), 'yyyy-MM-dd'), conf: 0.9 }
  if (/\btomorrow\b/.test(lower)) return { date: fmtDate(addDays(now, 1), 'yyyy-MM-dd'), conf: 0.9 }
  if (/\btoday\b|\bnow\b/.test(lower)) return { date: todayISO(), conf: 0.9 }

  const daysAgo = lower.match(/(\d+)\s+days?\s+ago/)
  if (daysAgo) return { date: fmtDate(subDays(now, parseInt(daysAgo[1], 10)), 'yyyy-MM-dd'), conf: 0.85 }

  // dd/mm/yyyy or dd-mm-yyyy
  const numeric = lower.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/)
  if (numeric) {
    const d = numeric[1].padStart(2, '0')
    const mo = numeric[2].padStart(2, '0')
    let y = numeric[3]
    if (y.length === 2) y = '20' + y
    return { date: `${y}-${mo}-${d}`, conf: 0.85 }
  }

  // dd Mon [yyyy]
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const named = lower.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{4})?/)
  if (named) {
    const d = named[1].padStart(2, '0')
    const mo = (months.indexOf(named[2]) + 1).toString().padStart(2, '0')
    const y = named[3] ?? now.getFullYear().toString()
    return { date: `${y}-${mo}-${d}`, conf: 0.8 }
  }

  return { date: todayISO(), conf: 0.5 }
}

function parseDueInDays(text: string): number | null {
  const lower = text.toLowerCase()
  const m = lower.match(/due\s+in\s+(\d+)\s*days?/)
  if (m) return parseInt(m[1], 10)
  const netM = lower.match(/net\s*(\d+)/)
  if (netM) return parseInt(netM[1], 10)
  if (/due\s+(next|in a)\s+week/.test(lower)) return 7
  if (/due\s+(next|in a)\s+month/.test(lower)) return 30
  return null
}

/** Build a short human description from the phrase. */
function buildDescription(text: string, party: string | null): string {
  // grab text after "for" as the description
  const forMatch = text.match(/\bfor\s+(.+?)(?:\s+(?:due|yesterday|today|tomorrow|on\b|via|by\b|$))/i)
  if (forMatch) {
    const d = forMatch[1].replace(/[.,;]$/g, '').trim()
    if (d.length > 1 && !/^\d/.test(d)) return titleCase(d)
  }
  if (party) return `Transaction with ${party}`
  return text.trim().slice(0, 60)
}

export const AIExtractionService = {
  /** Parse free text into a structured transaction candidate. */
  extractFromText(text: string): Extraction {
    const warnings: string[] = []
    const clean = text.trim()
    const { type, conf: typeConf } = detectType(clean)
    const { amount, conf: amtConf } = parseAmount(clean)
    const party = parseParty(clean, type)
    const { date, conf: dateConf } = parseDate(clean)
    const category = inferCategory(clean, type)
    const due_in_days = type === 'invoice' ? parseDueInDays(clean) : null
    const description = buildDescription(clean, party)

    if (amount === null) warnings.push('Could not detect an amount — please enter it.')
    if (!party && type !== 'transfer') warnings.push('Could not detect a name — add the customer/vendor.')

    // Confidence is the product-ish of components, weighted toward amount+type
    let confidence = 0
    if (amount !== null) {
      confidence = 0.35 * typeConf + 0.4 * amtConf + 0.15 * (party ? 0.95 : 0.4) + 0.1 * dateConf
    } else {
      confidence = 0.2 * typeConf
    }
    confidence = Math.round(confidence * 100) / 100

    return {
      type,
      amount,
      currency: 'INR',
      party,
      party_type: type === 'income' || type === 'invoice' ? 'customer' : type === 'expense' ? 'vendor' : null,
      category,
      date,
      description,
      confidence,
      due_in_days,
      raw: clean,
      warnings,
    }
  },

  /**
   * Best-effort read of an uploaded receipt/screenshot. Without a remote OCR
   * model this returns a low-confidence scaffold seeded from filename hints,
   * so the user always reviews before saving (never silently persisted).
   */
  async extractFromImage(file: File): Promise<Extraction> {
    const nameHints = file.name.toLowerCase()
    const guessParty =
      /amazon/.test(nameHints) ? 'Amazon' :
      /swiggy|zomato/.test(nameHints) ? 'Food Delivery' :
      /uber|ola/.test(nameHints) ? 'Ride' : null
    const category = guessParty ? inferCategory(guessParty, 'expense') : 'Other'
    return {
      type: 'expense',
      amount: null,
      currency: 'INR',
      party: guessParty,
      party_type: 'vendor',
      category,
      date: todayISO(),
      description: file.name.replace(/\.[^.]+$/, ''),
      confidence: 0.3,
      raw: `image:${file.name}`,
      warnings: [
        'On-device image reading is limited — please confirm the amount, date and merchant below.',
      ],
    }
  },

  /**
   * Attempt to pull text out of a PDF for invoice extraction. Falls back to a
   * review scaffold. Always requires user confirmation.
   */
  async extractFromPdf(file: File): Promise<Extraction & { invoice_number?: string | null }> {
    let text = ''
    try {
      // naive text scrape — works for text-based PDFs, ignored for scans
      const buf = await file.arrayBuffer()
      const decoder = new TextDecoder('latin1')
      const raw = decoder.decode(buf)
      const matches = raw.match(/\(([^()]{2,})\)/g) || []
      text = matches.map((m) => m.slice(1, -1)).join(' ')
    } catch {
      /* ignore */
    }
    const invNumMatch = text.match(/INV[-\s]?(\d+)/i)
    const base = this.extractFromText(text || file.name)
    return {
      ...base,
      type: 'expense',
      confidence: Math.min(base.confidence, 0.45),
      invoice_number: invNumMatch ? invNumMatch[0] : null,
      warnings: [
        'Extracted on-device from the PDF text layer — please verify every field before saving.',
      ],
    }
  },
}

export function confidenceLabel(c: number): { label: string; tone: 'high' | 'medium' | 'low' } {
  if (c >= 0.8) return { label: 'High confidence', tone: 'high' }
  if (c >= 0.55) return { label: 'Medium confidence', tone: 'medium' }
  return { label: 'Low confidence', tone: 'low' }
}
