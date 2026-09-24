import { useState } from 'react'
import { GoogleAuth } from '@/services/google/auth'
import { Wallet, Users, FileText, ShieldCheck, AlertTriangle } from 'lucide-react'

export function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const signIn = async () => {
    setBusy(true)
    setError('')
    try {
      await GoogleAuth.signIn()
      // On success, the auth store updates and the app renders past the gate.
    } catch (e: any) {
      setError(e?.message ?? 'Sign-in failed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="app-bg flex min-h-[100dvh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
            <svg width="30" height="30" viewBox="0 0 64 64" fill="none"><path d="M22 29h20a1 1 0 0 1 0 6H31l11 13h-8L23 35h-1v13h-6V20h6v9z" fill="currentColor" /><path d="M22 20h20a1 1 0 0 1 0 6H22v-6z" fill="currentColor" opacity="0.9" /></svg>
          </div>
          <h1 className="gradient-text text-2xl font-extrabold">FinSutra</h1>
          <p className="mt-1 text-sm text-ink-500">FlaminQo Events · money, understood</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-ink-900">Sign in</h2>
          <p className="mt-1 text-sm text-ink-500">Use your FlaminQo Google account to access the books.</p>

          <button onClick={signIn} disabled={busy} className="btn-secondary mt-5 w-full py-3 text-base">
            <GoogleGlyph />
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-xs text-ink-500">
            <Feature icon={<Wallet className="h-3.5 w-3.5" />} text="Track every rupee in and out" />
            <Feature icon={<Users className="h-3.5 w-3.5" />} text="Shared books for the team" />
            <Feature icon={<FileText className="h-3.5 w-3.5" />} text="Syncs to your private Google Sheet" />
            <Feature icon={<ShieldCheck className="h-3.5 w-3.5" />} text="Access limited to approved accounts" />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-ink-400">Only approved FlaminQo accounts can sign in.</p>
      </div>
    </div>
  )
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600">{icon}</span>
      {text}
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
