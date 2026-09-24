// ---------------------------------------------------------------------------
// Drive helpers — locate/create folders and upload evidence images into the
// FlaminQo folder. Uses the authenticated GoogleAuth.apiFetch.
// ---------------------------------------------------------------------------

import { GoogleAuth } from './auth'

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export interface DriveFile {
  id: string
  name: string
  webViewLink?: string
}

function esc(s: string) {
  return s.replace(/'/g, "\\'")
}

/** Find a direct child of `parentId` by name (optionally by mime type). */
export async function findChild(
  name: string,
  parentId: string,
  mimeType?: string,
): Promise<DriveFile | null> {
  let q = `name='${esc(name)}' and '${parentId}' in parents and trashed=false`
  if (mimeType) q += ` and mimeType='${mimeType}'`
  const url = `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&pageSize=1`
  const r = await GoogleAuth.apiFetch(url)
  if (!r.ok) throw new Error(`Drive lookup failed (${r.status})`)
  const data = await r.json()
  return data.files?.[0] ?? null
}

export async function createFolder(name: string, parentId: string): Promise<DriveFile> {
  const r = await GoogleAuth.apiFetch(`${DRIVE}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  })
  if (!r.ok) throw new Error(`Could not create folder "${name}" (${r.status})`)
  return r.json()
}

const folderCache = new Map<string, string>()

export async function ensureFolder(name: string, parentId: string): Promise<string> {
  const key = `${parentId}/${name}`
  if (folderCache.has(key)) return folderCache.get(key)!
  const found = (await findChild(name, parentId, FOLDER_MIME)) ?? (await createFolder(name, parentId))
  folderCache.set(key, found.id)
  return found.id
}

/** Ensure Evidence/YYYY-MM exists; return that folder's id. */
export async function ensureMonthFolder(
  rootFolderId: string,
  evidenceName: string,
  monthKey: string, // 'YYYY-MM'
): Promise<string> {
  const evidenceId = await ensureFolder(evidenceName, rootFolderId)
  return ensureFolder(monthKey, evidenceId)
}

/** Upload an image/file into a folder; returns the file with a viewable link. */
export async function uploadFile(file: Blob, filename: string, parentId: string): Promise<DriveFile> {
  const metadata = { name: filename, parents: [parentId] }
  const boundary = 'finsutra_' + Math.random().toString(36).slice(2)
  const head =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`
  const tail = `\r\n--${boundary}--`
  const body = new Blob([head, file, tail], { type: `multipart/related; boundary=${boundary}` })

  const r = await GoogleAuth.apiFetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: 'POST',
    body,
  })
  if (!r.ok) throw new Error(`Evidence upload failed (${r.status})`)
  return r.json()
}
