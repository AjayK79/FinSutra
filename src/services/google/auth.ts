// ---------------------------------------------------------------------------
// GoogleAuth — "Sign in with Google", gated to an allowlist. This is FinSutra's
// login for FlaminQo. Uses Google Identity Services (GIS) token flow entirely
// client-side; no backend. A session (email + access token) is cached so the
// app stays usable offline after the first sign-in.
// ---------------------------------------------------------------------------

import { getClientId } from '@/services/GoogleDriveService'
import { GOOGLE, isAllowed } from '@/config'

declare global {
  interface Window {
    google?: any
  }
}

interface Session {
  email: string
  token: string
  expiry: number // epoch ms
}

const SESSION_KEY = 'finsutra_google_session'

type Listener = () => void
const listeners = new Set<Listener>()
function emit() {
  listeners.forEach((l) => l())
}

function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}
function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  emit()
}

let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisPromise) return gisPromise
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection.'))
    document.head.appendChild(s)
  })
  return gisPromise
}

async function fetchEmail(token: string): Promise<string | null> {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    const info = await r.json()
    return info.email ?? null
  } catch {
    return null
  }
}

function requestToken(interactive: boolean): Promise<string> {
  const clientId = getClientId()
  if (!clientId) return Promise.reject(new Error('No Google Client ID configured. Add it in Settings.'))
  return new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE.scopes,
      prompt: interactive ? 'consent' : '',
      callback: (resp: any) => {
        if (resp.error) reject(new Error(resp.error_description || resp.error))
        else resolve(resp.access_token)
      },
      error_callback: (err: any) => reject(new Error(err?.message || 'Sign-in was cancelled.')),
    })
    client.requestAccessToken()
  })
}

export const GoogleAuth = {
  isConfigured(): boolean {
    return !!getClientId()
  },

  /** Has the user signed in at least once (session cached, maybe offline)? */
  hasSession(): boolean {
    return !!readSession()
  },

  currentEmail(): string | null {
    return readSession()?.email ?? null
  },

  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },

  /** Interactive sign-in. Enforces the allowlist; throws if not permitted. */
  async signIn(): Promise<Session> {
    await loadGis()
    const token = await requestToken(true)
    const email = await fetchEmail(token)
    if (!email) throw new Error('Could not read your Google account email.')
    if (!isAllowed(email)) {
      // do not persist an unauthorized session
      try {
        window.google?.accounts?.oauth2?.revoke?.(token, () => {})
      } catch {
        /* ignore */
      }
      throw new Error(`${email} is not authorised to use this app. Contact the owner for access.`)
    }
    const session: Session = { email, token, expiry: Date.now() + 55 * 60 * 1000 }
    writeSession(session)
    return session
  },

  async signOut(): Promise<void> {
    const s = readSession()
    if (s?.token) {
      try {
        window.google?.accounts?.oauth2?.revoke?.(s.token, () => {})
      } catch {
        /* ignore */
      }
    }
    writeSession(null)
  },

  /**
   * Return a valid access token, refreshing silently if expired. Requires the
   * user to have signed in before and to be online. Throws otherwise.
   */
  async getAccessToken(): Promise<string> {
    const s = readSession()
    if (!s) throw new Error('Please sign in with Google first.')
    if (s.token && s.expiry > Date.now() + 60_000) return s.token
    // refresh
    await loadGis()
    const token = await requestToken(false)
    const email = (await fetchEmail(token)) ?? s.email
    if (!isAllowed(email)) {
      writeSession(null)
      throw new Error('This account is no longer authorised.')
    }
    const next: Session = { email, token, expiry: Date.now() + 55 * 60 * 1000 }
    writeSession(next)
    return token
  },

  /** Authenticated fetch to Google APIs. */
  async apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  },
}
