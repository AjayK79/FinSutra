import { useEffect, useState } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'

const DISMISS_KEY = 'finsutra_install_dismissed'

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  )
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !(window as any).MSStream
}

/**
 * Prompts the user to install FinSutra as an app.
 * - Android/Chrome: uses the native `beforeinstallprompt` event.
 * - iOS Safari: shows a one-time "Add to Home Screen" hint (Apple blocks the prompt).
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {
      /* ignore */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS never fires beforeinstallprompt — show a hint after a short delay
    let t: ReturnType<typeof setTimeout> | undefined
    if (isIOS()) {
      t = setTimeout(() => {
        setIosHint(true)
        setShow(true)
      }, 2500)
    }

    const onInstalled = () => dismiss()
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      if (t) clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try {
      await deferred.userChoice
    } catch {
      /* ignore */
    }
    dismiss()
  }

  if (!show) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+84px)] lg:pb-4">
      <div className="glass flex w-full max-w-md items-center gap-3 rounded-2xl p-3 shadow-pop">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-fuchsia-500 text-white shadow-glow-sm">
          <svg width="20" height="20" viewBox="0 0 64 64" fill="none"><path d="M22 29h20a1 1 0 0 1 0 6H31l11 13h-8L23 35h-1v13h-6V20h6v9z" fill="currentColor" /><path d="M22 20h20a1 1 0 0 1 0 6H22v-6z" fill="currentColor" opacity="0.9" /></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">Install FinSutra</p>
          {iosHint ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
              Tap <Share className="inline h-3.5 w-3.5" /> then <span className="inline-flex items-center gap-0.5 font-medium">Add to Home Screen <Plus className="h-3 w-3" /></span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-500">Add it to your home screen — works offline, opens full-screen.</p>
          )}
        </div>
        {!iosHint && (
          <button onClick={install} className="btn-primary shrink-0 px-3 py-2 text-xs">
            <Download className="h-4 w-4" /> Install
          </button>
        )}
        <button onClick={dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
