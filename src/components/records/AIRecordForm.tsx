import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Mic, MicOff, CornerDownLeft } from 'lucide-react'
import { AIExtractionService, type Extraction } from '@/services/AIExtractionService'
import { ExtractionReview, type ResolvedRecord } from './ExtractionReview'
import { applyResolved } from './apply'
import { toast } from '@/state/store'
import { formatMoney } from '@/lib/format'

const EXAMPLES = [
  'Paid ₹18,500 to ABC Printers for brochures',
  'Received 75000 from XYZ Corp today',
  'Create invoice for ABC Technologies for 2 lakh for LMS implementation, due in 30 days',
  'Spent 4850 on AWS yesterday',
]

// Web Speech API typing
type SpeechRecognitionCtor = new () => any

export function AIRecordForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const [text, setText] = useState('')
  const [extraction, setExtraction] = useState<Extraction | null>(null)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const navigate = useNavigate()

  const SR: SpeechRecognitionCtor | undefined =
    (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || undefined

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const toggleVoice = () => {
    if (!SR) {
      toast('info', 'Voice input isn’t supported in this browser — please type instead.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const rec = new SR()
    rec.lang = 'en-IN'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e: any) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript
      setText(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  const understand = () => {
    if (!text.trim()) return
    const ex = AIExtractionService.extractFromText(text)
    setExtraction(ex)
  }

  const handleConfirm = async (r: ResolvedRecord) => {
    if (r.type === 'invoice') {
      onDone()
      navigate('/invoices/new', {
        state: {
          prefill: {
            customerName: extraction?.party,
            amount: r.amount,
            description: r.description,
            due_in_days: r.due_in_days,
          },
        },
      })
      return
    }
    await applyResolved(companyId, r)
    toast('success', `${formatMoney(r.amount, 'INR')} ${r.type} recorded.`)
    onDone()
  }

  if (extraction) {
    return (
      <ExtractionReview
        extraction={extraction}
        companyId={companyId}
        onBack={() => setExtraction(null)}
        onConfirm={handleConfirm}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) understand()
          }}
          placeholder="Tell me what happened…  e.g. Paid ₹18,500 to ABC Printers for brochures"
          className="input min-h-[110px] resize-none pr-12 text-base"
          autoFocus
        />
        <button
          onClick={toggleVoice}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition ${
            listening ? 'animate-pulse bg-rose-500 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
          }`}
          title="Speak to FinSutra"
        >
          {listening ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
        </button>
      </div>

      {listening && <p className="text-center text-sm font-medium text-rose-600">Listening… speak now</p>}

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setText(ex)}
            className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            {ex}
          </button>
        ))}
      </div>

      <button onClick={understand} disabled={!text.trim()} className="btn-primary w-full">
        <Sparkles className="h-4 w-4" />
        Understand &amp; Record
        <kbd className="ml-1 hidden items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px] sm:inline-flex">
          <CornerDownLeft className="h-3 w-3" />
        </kbd>
      </button>
      <p className="text-center text-xs text-ink-400">
        Runs entirely on your device — no data leaves FinSutra. You confirm before anything is saved.
      </p>
    </div>
  )
}
