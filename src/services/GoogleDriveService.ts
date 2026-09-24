// ---------------------------------------------------------------------------
// GoogleDriveService — backup/sync target. Google Drive is NEVER the primary
// database; the local IndexedDB is. This service exposes one interface with
// two implementations:
//   • RealDrive  — Google Identity Services token flow + Drive v3 REST API.
//                   Activated when a real OAuth Client ID is configured.
//   • DemoDrive  — a clearly-labelled offline simulation stored locally, so
//                   backup/restore/sync can be demonstrated without OAuth.
// The app picks Demo automatically when no Client ID is set. Nothing fake is
// ever presented as a real Google connection.
// ---------------------------------------------------------------------------

const CLIENT_ID_KEY = 'finsutra_gdrive_client_id'
const DEMO_STORE_KEY = 'finsutra_demo_drive'
const TOKEN_KEY = 'finsutra_gdrive_token'
const SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid'

export interface DriveStatus {
  connected: boolean
  demo: boolean
  email?: string
  configured: boolean
}

export interface DriveFileRef {
  id: string
  name: string
  path: string
}

export interface IGoogleDrive {
  readonly demo: boolean
  isConfigured(): boolean
  status(): DriveStatus
  connect(): Promise<DriveStatus>
  disconnect(): Promise<void>
  /** Ensure the FinSutra/... folder tree exists, return the root folder id. */
  ensureStructure(): Promise<string>
  /** Upload (create or overwrite) a JSON file at a logical path. */
  putJson(path: string, data: unknown): Promise<void>
  /** Read a JSON file, or null if it doesn't exist. */
  getJson<T = unknown>(path: string): Promise<T | null>
  listBackups(): Promise<DriveFileRef[]>
}

// -- Client id storage -------------------------------------------------------

// FlaminQo's OAuth Web Client ID (public by design). Baked in so sign-in works
// out of the box; can still be overridden per-device via Settings / env.
const DEFAULT_CLIENT_ID = '1019599257121-6og4brnofhjsvk27sm56ohcg6fdoo5p0.apps.googleusercontent.com'

export function getClientId(): string {
  try {
    return (
      localStorage.getItem(CLIENT_ID_KEY) ||
      (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
      DEFAULT_CLIENT_ID
    )
  } catch {
    return DEFAULT_CLIENT_ID
  }
}
export function setClientId(id: string) {
  try {
    if (id) localStorage.setItem(CLIENT_ID_KEY, id.trim())
    else localStorage.removeItem(CLIENT_ID_KEY)
  } catch {
    /* ignore */
  }
}

// -- Demo implementation -----------------------------------------------------

class DemoDrive implements IGoogleDrive {
  readonly demo = true

  private read(): Record<string, unknown> {
    try {
      return JSON.parse(localStorage.getItem(DEMO_STORE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }
  private write(store: Record<string, unknown>) {
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store))
  }

  isConfigured() {
    return true // demo is always "available"
  }
  status(): DriveStatus {
    const store = this.read()
    return {
      connected: !!store.__connected,
      demo: true,
      email: (store.__email as string) || 'demo@finsutra.local',
      configured: true,
    }
  }
  async connect(): Promise<DriveStatus> {
    // simulate a short handshake
    await delay(600)
    const store = this.read()
    store.__connected = true
    store.__email = 'demo@finsutra.local'
    this.write(store)
    return this.status()
  }
  async disconnect() {
    const store = this.read()
    delete store.__connected
    this.write(store)
  }
  async ensureStructure(): Promise<string> {
    return 'demo-root'
  }
  async putJson(path: string, data: unknown) {
    await delay(120)
    const store = this.read()
    store[path] = data
    this.write(store)
  }
  async getJson<T>(path: string): Promise<T | null> {
    const store = this.read()
    return (store[path] as T) ?? null
  }
  async listBackups(): Promise<DriveFileRef[]> {
    const store = this.read()
    return Object.keys(store)
      .filter((k) => k.startsWith('Backups/'))
      .map((k) => ({ id: k, name: k.split('/').pop() || k, path: k }))
  }
}

// -- Real Google Drive implementation ---------------------------------------

declare global {
  interface Window {
    google?: any
  }
}

class RealDrive implements IGoogleDrive {
  readonly demo = false
  private token: string | null = null
  private email: string | null = null
  private folderCache = new Map<string, string>()

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null')
      if (saved && saved.token && saved.expiry > Date.now()) {
        this.token = saved.token
        this.email = saved.email
      }
    } catch {
      /* ignore */
    }
  }

  isConfigured() {
    return !!getClientId()
  }
  status(): DriveStatus {
    return {
      connected: !!this.token,
      demo: false,
      email: this.email ?? undefined,
      configured: this.isConfigured(),
    }
  }

  private async loadGis(): Promise<void> {
    if (window.google?.accounts?.oauth2) return
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('gis-script')
      if (existing) {
        existing.addEventListener('load', () => resolve())
        return
      }
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.id = 'gis-script'
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Could not load Google Identity Services. Check your connection.'))
      document.head.appendChild(s)
    })
  }

  async connect(): Promise<DriveStatus> {
    const clientId = getClientId()
    if (!clientId) throw new Error('No Google OAuth Client ID configured.')
    await this.loadGis()
    const token = await new Promise<string>((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (resp: any) => {
          if (resp.error) reject(new Error(resp.error_description || resp.error))
          else resolve(resp.access_token)
        },
      })
      client.requestAccessToken({ prompt: 'consent' })
    })
    this.token = token
    // fetch email
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const info = await r.json()
      this.email = info.email
    } catch {
      this.email = null
    }
    try {
      localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify({ token, email: this.email, expiry: Date.now() + 3500 * 1000 }),
      )
    } catch {
      /* ignore */
    }
    return this.status()
  }

  async disconnect() {
    const t = this.token
    this.token = null
    this.email = null
    this.folderCache.clear()
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    if (t && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(t, () => {})
      } catch {
        /* ignore */
      }
    }
  }

  private authHeaders(extra: Record<string, string> = {}) {
    if (!this.token) throw new Error('Google Drive is not connected.')
    return { Authorization: `Bearer ${this.token}`, ...extra }
  }

  private async findFolder(name: string, parentId: string): Promise<string | null> {
    const q = encodeURIComponent(
      `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    )
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      { headers: this.authHeaders() },
    )
    const data = await r.json()
    return data.files?.[0]?.id ?? null
  }

  private async createFolder(name: string, parentId?: string): Promise<string> {
    const r = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    })
    const data = await r.json()
    return data.id
  }

  private async ensureFolder(name: string, parentId: string): Promise<string> {
    const cacheKey = `${parentId}/${name}`
    if (this.folderCache.has(cacheKey)) return this.folderCache.get(cacheKey)!
    let id = await this.findFolder(name, parentId)
    if (!id) id = await this.createFolder(name, parentId)
    this.folderCache.set(cacheKey, id)
    return id
  }

  async ensureStructure(): Promise<string> {
    // root FinSutra folder (in appDataFolder-like user drive, drive.file scope)
    let rootId = this.folderCache.get('root/FinSutra')
    if (!rootId) {
      rootId = (await this.findFolder('FinSutra', 'root')) ?? (await this.createFolder('FinSutra'))
      this.folderCache.set('root/FinSutra', rootId)
    }
    await Promise.all([
      this.ensureFolder('Company', rootId),
      this.ensureFolder('Data', rootId),
      this.ensureFolder('Documents', rootId),
      this.ensureFolder('Reports', rootId),
      this.ensureFolder('Backups', rootId),
    ])
    return rootId
  }

  private async resolvePath(path: string): Promise<{ folderId: string; filename: string }> {
    const rootId = await this.ensureStructure()
    const parts = path.split('/')
    const filename = parts.pop()!
    let parent = rootId
    for (const dir of parts) {
      parent = await this.ensureFolder(dir, parent)
    }
    return { folderId: parent, filename }
  }

  private async findFile(name: string, parentId: string): Promise<string | null> {
    const q = encodeURIComponent(`name='${name}' and '${parentId}' in parents and trashed=false`)
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      { headers: this.authHeaders() },
    )
    const data = await r.json()
    return data.files?.[0]?.id ?? null
  }

  async putJson(path: string, data: unknown) {
    const { folderId, filename } = await this.resolvePath(path)
    const existingId = await this.findFile(filename, folderId)
    const metadata = existingId ? {} : { name: filename, parents: [folderId] }
    const boundary = 'finsutra_boundary_' + Math.random().toString(36).slice(2)
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify(data) +
      `\r\n--${boundary}--`
    const url = existingId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
    const r = await fetch(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: this.authHeaders({ 'Content-Type': `multipart/related; boundary=${boundary}` }),
      body,
    })
    if (!r.ok) throw new Error(`Drive upload failed (${r.status})`)
  }

  async getJson<T>(path: string): Promise<T | null> {
    const { folderId, filename } = await this.resolvePath(path)
    const id = await this.findFile(filename, folderId)
    if (!id) return null
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
      headers: this.authHeaders(),
    })
    if (!r.ok) return null
    return (await r.json()) as T
  }

  async listBackups(): Promise<DriveFileRef[]> {
    try {
      const rootId = await this.ensureStructure()
      const backupsId = await this.ensureFolder('Backups', rootId)
      const q = encodeURIComponent(`'${backupsId}' in parents and trashed=false`)
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
        { headers: this.authHeaders() },
      )
      const data = await r.json()
      return (data.files ?? []).map((f: any) => ({ id: f.id, name: f.name, path: `Backups/${f.name}` }))
    } catch {
      return []
    }
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// -- Factory -----------------------------------------------------------------

let instance: IGoogleDrive | null = null
let usingDemo = false

export function getDrive(): IGoogleDrive {
  const hasClientId = !!getClientId()
  if (!instance || usingDemo === hasClientId) {
    // recreate when the mode should change
    usingDemo = !hasClientId
    instance = hasClientId ? new RealDrive() : new DemoDrive()
  }
  return instance
}

export function resetDrive() {
  instance = null
}
