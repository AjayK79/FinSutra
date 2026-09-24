import { useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany, useTransactions, useInvoices, useCustomers, useVendors, usePayments } from '@/state/hooks'
import { AICFOService, type CFOAnswer, type CFOContext } from '@/services/AICFOService'
import { PageHeader } from '@/components/ui/StatCard'
import { Sparkles, Send, ArrowRight, User } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Msg {
  role: 'user' | 'cfo'
  text?: string
  answer?: CFOAnswer
}

export function AICFO() {
  const company = useCompany()
  const transactions = useTransactions()
  const invoices = useInvoices()
  const customers = useCustomers()
  const vendors = useVendors()
  const payments = usePayments()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const ctx: CFOContext | null = useMemo(
    () => (company ? { company, transactions, invoices, customers, vendors, payments } : null),
    [company, transactions, invoices, customers, vendors, payments],
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const ask = (question: string) => {
    if (!question.trim() || !ctx) return
    const answer = AICFOService.answer(question, ctx)
    setMessages((m) => [...m, { role: 'user', text: question }, { role: 'cfo', answer }])
    setInput('')
  }

  const suggestions = AICFOService.suggestedQuestions()

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col lg:h-[calc(100vh-6rem)]">
      <PageHeader title="AI CFO" subtitle="Ask questions about your business finances — answered from your ledger, on-device." />

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white"><Sparkles className="h-5 w-5" /></div>
            <h2 className="text-lg font-semibold text-ink-900">Hi{company ? `, ${company.owner_name}` : ''} 👋</h2>
            <p className="mt-1 text-sm text-ink-500">I can answer questions about your cash, receivables, payables, invoices and spending — using only your recorded data. Try one of these:</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((q) => (
                <button key={q} onClick={() => ask(q)} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="flex max-w-[85%] items-start gap-2">
                <div className="rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white">{m.text}</div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-200 text-ink-600"><User className="h-4 w-4" /></div>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Sparkles className="h-4 w-4" /></div>
              <div className="max-w-[85%] space-y-3 rounded-2xl rounded-tl-sm border border-ink-100 bg-white px-4 py-3 shadow-card">
                <p className="text-sm text-ink-800">{m.answer?.text}</p>
                {m.answer?.bullets && m.answer.bullets.length > 0 && (
                  <div className="space-y-1.5 rounded-xl bg-ink-50 p-3">
                    {m.answer.bullets.map((b, j) => (
                      <div key={j} className="flex items-center justify-between text-sm">
                        <span className="text-ink-600">{b.label}{b.sub && <span className="ml-1 text-xs text-ink-400">· {b.sub}</span>}</span>
                        <span className="font-semibold text-ink-900 tnum">{b.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {m.answer?.action && (
                  <button onClick={() => navigate(m.answer!.action!.to)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                    {m.answer.action.label} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {m.answer?.followUp && m.answer.followUp.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.answer.followUp.map((q) => (
                      <button key={q} onClick={() => ask(q)} className="rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50">{q}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-ink-100 bg-white pt-3">
        <div className={cn('flex items-center gap-2 rounded-2xl border border-ink-200 bg-white p-1.5 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20')}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask(input)}
            placeholder="Ask about your finances…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button onClick={() => ask(input)} disabled={!input.trim()} className="btn-primary rounded-xl px-3 py-2 disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-center text-xs text-ink-400">Answers come only from your recorded data. FinSutra won't invent numbers.</p>
      </div>
    </div>
  )
}
